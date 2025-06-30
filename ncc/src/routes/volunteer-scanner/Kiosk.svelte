<script lang="ts">
	import { onMount } from 'svelte';
	import { forgotToSignOutGrantHours, version } from './constants';

	const databaseName = 'volunteerScanner';
	const databaseVersion = 1;
	const oneHour = 1000 * 60 * 60;
	let topText = $state('Loading...');
	let bottomText = $state('Just a moment...');
	let timeoutId: number;

	function resetText() {
		topText = 'Welcome!';
		bottomText = 'Volunteers, please scan your barcode.';
	}

	interface AccountScan {
		accountNumber: number;
		timestamp: Date;
	}

	async function openIndexedDb(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const idb = indexedDB.open(databaseName, databaseVersion);

			idb.onsuccess = (event) => {
				resolve(idb.result);
			};

			idb.onerror = (event) => {
				reject(idb.error);
			};

			idb.onupgradeneeded = (event) => {
				const db = (event.target as IDBRequest).result as IDBDatabase;
				const objectStore = db.createObjectStore('scans', { autoIncrement: true });

				objectStore.createIndex('accountNumber', 'accountNumber', { unique: false });
				objectStore.createIndex('timestamp', 'timestamp', { unique: false });
			};
		});
	}

	async function getAccountScans(db: IDBDatabase, accountNumber: number): Promise<AccountScan[]> {
		return new Promise(async (resolve, reject) => {
			const tx = db.transaction('scans', 'readonly');
			const o = tx.objectStore('scans').index('accountNumber').getAll(accountNumber);

			o.onsuccess = (event) => {
				resolve(o.result);
			};

			o.onerror = (event) => {
				reject(o.error);
			};
		});
	}

	async function getEtapestryAccountName(accountNumber: number) {
		const { accountName }: { accountName: string } = await (
			await fetch('/volunteer-scanner/name', {
				method: 'POST',
				body: JSON.stringify({ accountNumber }),
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json'
				}
			})
		).json();

		return accountName;
	}

	async function addHours(accountNumber: number, isForgot: boolean, hours?: number) {
		if (hours) {
			hours = Math.ceil(hours);
		}

		const { accountName }: { accountName: string } = await (
			await fetch('/volunteer-scanner/add-hours', {
				method: 'POST',
				body: JSON.stringify({ accountNumber, hours, isForgot }),
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json'
				}
			})
		).json();

		return accountName;
	}

	async function handleScan(accountNumber: number) {
		const db = await openIndexedDb();
		const accountScans = await getAccountScans(db, accountNumber);

		if (accountScans.length % 2 === 0) {
			// State: Currently Signed Out
			// Action: Sign User In
			const tx = db.transaction('scans', 'readwrite');
			tx.objectStore('scans').add({ accountNumber: accountNumber, timestamp: new Date() });
			tx.commit();

			return {
				accountName: await getEtapestryAccountName(accountNumber),
				state: 'signedIn'
			};
		} else {
			// State: Currently Signed In (or Forgot to Sign Out)
			// Action: Sign User Out

			// Timestamp of the last time the user signed in
			const previousSignInTimestamp = accountScans.at(-1)!['timestamp'] as Date;

			// Timestamp of the time the user should have signed out.
			// This is at the end of the day that the user last signed in.
			const mustSignOutByTimestamp = new Date(
				previousSignInTimestamp.getFullYear(),
				previousSignInTimestamp.getMonth(),
				previousSignInTimestamp.getDate(),
				23,
				59,
				59,
				999
			);

			const now = new Date();

			if (now.getTime() > mustSignOutByTimestamp.getTime()) {
				// They forgot to sign out.
				// This is because the current timestamp is after the timestamp that they should have signed out by.
				const a = previousSignInTimestamp.getTime() + oneHour * forgotToSignOutGrantHours;
				const b = mustSignOutByTimestamp.getTime();
				const signOutTimestamp = new Date(Math.min(a, b));
				const tx = db.transaction('scans', 'readwrite');

				try {
					tx.objectStore('scans').add({ accountNumber: accountNumber, timestamp: signOutTimestamp });
					tx.objectStore('scans').add({ accountNumber: accountNumber, timestamp: now });
					tx.commit();

					return {
						accountName: await addHours(accountNumber, true),
						state: 'signedIn'
					};
				} catch (err) {
					tx.abort();
					console.error(err);
					return { error: err };
				}
			} else {
				// They did not forget to sign out. They are actually looking to sign out.
				const signOutTimestamp = new Date();
				const hours = (signOutTimestamp.getTime() - previousSignInTimestamp.getTime()) / oneHour;
				const tx = db.transaction('scans', 'readwrite');

				try {
					tx.objectStore('scans').add({ accountNumber: accountNumber, timestamp: signOutTimestamp });

					return {
						accountName: await addHours(accountNumber, false, hours),
						state: 'signedOut'
					};
				} catch (err) {
					tx.abort();
					console.error(err);
					return { error: err };
				}
			}
		}
	}

	onMount(resetText);
</script>

<form
	method="post"
	onsubmit={async (event) => {
		event.preventDefault();
		clearTimeout(timeoutId);

		const formData = new FormData(event.target as HTMLFormElement);
		const accountNumber = Number(formData.get('code'));

		topText = 'Please wait...';
		bottomText = "We're updating our database. Please wait a moment.";

		const response = await handleScan(accountNumber);
		console.log(response);

		if (response.error) {
			topText = 'Whoops, something went wrong.';
			bottomText = ' Please scan again or sign in on the sheet.';
			return;
		}

		if (response.state === 'signedIn') {
			topText = `Hi, ${response.accountName}!`;
			bottomText = "You've just signed in. Remember to sign out when you leave.";
		} else if (response.state === 'signedOut') {
			topText = `Goodbye, ${response.accountName}!`;
			bottomText =
				"You've just signed out. Thank you for volunteering at the Needham Community Council!";
		} else {
			topText = 'Whoops, something went wrong.';
			bottomText = ' Please scan again or sign in on the sheet.';
		}

		(event.target as HTMLFormElement).reset();
		timeoutId = setTimeout(resetText, 5000);
	}}
>
	<!-- Account Number -->
	<input
		type="number"
		autofocus={true}
		name="code"
		onblur={(event) => event.currentTarget.focus()}
	/>
</form>

<main>
	<h1>{topText}</h1>
	<h2>{bottomText}</h2>
</main>

<div class="bottom">
	<img alt="Needham Community Council logo" class="logo" src="/logo.png" />
	<p>v{version}</p>
</div>

<style>
	main {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
		width: 75vw;
		font-size: 40pt;
	}

	h1,
	h2 {
		font-weight: 900;
	}

	img {
		bottom: 10%;
		width: 200px;
	}

	input {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		border: 0;
		padding: 0;
		margin: 0;
		z-index: 10;
		cursor: none;
	}

	.bottom {
		position: fixed;
		text-align: center;
		position: fixed;
		top: 100%;
		left: 50%;
		transform: translate(-50%, -110%);
		font-weight: 250;
		font-size: 13pt;
	}

	.logo {
		margin-bottom: 4px;
	}
</style>
