import { EtApiSimpleClient } from "../../etapestry-client";

const databaseName = 'volunteerScanner';
const databaseVersion = 1;
const forgotToSignOutGrantHours = 2;
const oneHour = 1000 * 60 * 60;

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
            const objectStore = db.createObjectStore("scans", { autoIncrement: true });

            objectStore.createIndex("accountNumber", "accountNumber", { unique: false });
            objectStore.createIndex("timestamp", "timestamp", { unique: false });
        };
    });
}

async function getAccountScans(db: IDBDatabase, accountNumber: number): Promise<AccountScan[]> {
    return new Promise(async (resolve, reject) => {
        const tx = db.transaction("scans", "readonly");
        const o = tx.objectStore("scans").index("accountNumber").getAll(accountNumber);

        o.onsuccess = (event) => {
            resolve(o.result);
        };

        o.onerror = (event) => {
            reject(o.error);
        };
    });
}

async function handleScan(message: any, sendResponse: (response: any) => void) {
    const { accountNumber }: { accountNumber: number } = message;

    const { etapestryApiKey, etapestryDatabaseId }: { etapestryApiKey: string, etapestryDatabaseId: string } =
        await chrome.storage.local.get(['etapestryApiKey', 'etapestryDatabaseId']) as { etapestryApiKey: string, etapestryDatabaseId: string };

    const db = await openIndexedDb();
    const accountScans = await getAccountScans(db, accountNumber);
    const client = await EtApiSimpleClient.login(etapestryDatabaseId, etapestryApiKey);
    const account = await client.getAccountById(accountNumber.toString());
    const accountName = account['ns0:Account']['longSalutation']['#text'];
    const accountRef = account['ns0:Account']['ref']['#text'];

    if (accountScans.length % 2 === 0) {
        // State: Currently Signed Out
        // Action: Sign User In
        db.transaction("scans", "readwrite").objectStore("scans").add({ accountNumber: accountNumber, timestamp: new Date() });
        sendResponse({ name: accountName, state: 'signedIn' });
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

        if (now > mustSignOutByTimestamp) {
            // They forgot to sign out.
            // This is because the current timestamp is after the timestamp that they should have signed out by.
            const a = previousSignInTimestamp.getTime() + oneHour * forgotToSignOutGrantHours;
            const b = mustSignOutByTimestamp.getTime();
            const signOutTimestamp = new Date(Math.min(a, b));
            const tx = db.transaction("scans", "readwrite");

            try {
                tx.objectStore("scans").add({ accountNumber: accountNumber, timestamp: signOutTimestamp });
                tx.objectStore("scans").add({ accountNumber: accountNumber, timestamp: now });
                await client.addVolunteerHours(accountRef, forgotToSignOutGrantHours, `Imported automatically (NOTE: this person forgot to sign out, so they were awarded ${forgotToSignOutGrantHours} hours of volunteer time).`);
                tx.commit();
                sendResponse({ name: accountName, state: 'signedIn' });
            } catch (err) {
                tx.abort();
                console.error(err);
                sendResponse({ error: err });
            }
        } else {
            // They did not forget to sign out. They are actually looking to sign out.
            const signOutTimestamp = new Date();
            const hoursVolunteered = (signOutTimestamp.getTime() - previousSignInTimestamp.getHours()) / oneHour;
            const tx = db.transaction("scans", "readwrite");

            try {
                tx.objectStore("scans").add({ accountNumber: accountNumber, timestamp: signOutTimestamp });
                await client.addVolunteerHours(accountRef, hoursVolunteered, "Imported automatically.");
                sendResponse({ name: accountName, state: 'signedOut' });
            } catch (err) {
                tx.abort();
                console.error(err);
                sendResponse({ error: err });
            }
        }
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "scan") {
        handleScan(message, sendResponse);
    }

    return true;
});