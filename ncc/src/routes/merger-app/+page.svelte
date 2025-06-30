<script lang="ts">
	import { read } from 'xlsx';
	import Papa from 'papaparse';
	import { version } from './constants';

	interface EtapRecord {
		AccountNumber: string;
		LastName: string;
		FirstName: string;
		NumFoodPantryHouseholdMembers: string;
		NumFoodPantryElderMembers: string;
		NumFoodPantryAdultMembers: string;
		NumFoodPantryTeenMembers: string;
		NumFoodPantryChildrenMembers: string;
		PhoneNumber: string;
		EmailAddress: string;
	}

	interface SugRecord {
		Date: string;
		TimeSlot: string;
		FirstName: string;
		LastName: string;
		EmailAddress: string;
		SignUpComment: string;
		SignUpTimestamp: string;
		OrderSpecificItems: string;
	}

	interface MergedRecord {
		etap?: EtapRecord;
		sug: SugRecord;
	}

	let isProcessing = false;
	let showDownloads = false;
	let mergedCsvData = '';
	let rosterCsvData = '';

	async function parseSpreadsheet(file: File): Promise<string[][]> {
		if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
			return await parseXlsx(file);
		} else if (file.name.endsWith('.csv')) {
			return await parseCsv(file);
		}

		throw new Error('Unknown file type: ' + file.name);
	}

	async function parseXlsx(file: File): Promise<string[][]> {
		const workbook = read(await file.arrayBuffer());
		const sheetName = workbook.SheetNames[0];
		const sheet = workbook.Sheets[sheetName];
		const data: string[][] = [];

		// Get the range of cells in the sheet
		const range = sheet['!ref'];
		if (!range) {
			return []; // Handle empty sheet
		}

		// Parse the range string to get the start and end cells
		const [startCell, endCell] = range.split(':');
		const startCol = startCell.replace(/[^A-Z]/g, '');
		const startRow = parseInt(startCell.replace(/[^0-9]/g, ''), 10);
		const endCol = endCell.replace(/[^A-Z]/g, '');
		const endRow = parseInt(endCell.replace(/[^0-9]/g, ''), 10);

		// Iterate over rows
		for (let row = startRow; row <= endRow; row++) {
			const rowData: string[] = [];
			// Iterate over columns
			for (let colCode = startCol.charCodeAt(0); colCode <= endCol.charCodeAt(0); colCode++) {
				const col = String.fromCharCode(colCode);
				const cellAddress = col + row;
				const cell = sheet[cellAddress];
				const cellValue = cell ? cell.w || cell.v?.toString() || '' : ''; // Access 'w' for formatted value, 'v' for raw value
				rowData.push(cellValue);
			}
			data.push(rowData);
		}

		return data;
	}

	function parseCsv(file: File): Promise<string[][]> {
		return new Promise((resolve, reject) => {
			Papa.parse<string[]>(file, {
				skipEmptyLines: true,
				complete: (results) => resolve(results.data),
				error: (err) => reject(err)
			});
		});
	}

	function downloadCsv(filename: string, csvData: string) {
		const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	export async function handleSubmit(
		event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }
	) {
		event.preventDefault();
		const form = event.currentTarget;
		const etapFile = (form.etapestryReport as HTMLInputElement).files?.[0];
		const sugFile = (form.signUpGeniusReport as HTMLInputElement).files?.[0];

		if (!etapFile || !sugFile) {
			alert('Both files are required');
			return;
		}

		isProcessing = true;
		showDownloads = false;

		try {
			// 1) Read raw CSV arrays
			const [rawEtap, rawSug] = await Promise.all([
				parseSpreadsheet(etapFile),
				parseSpreadsheet(sugFile)
			]);

			// 2) Build typed arrays (skip headers/empty rows)
			const sugRecords: SugRecord[] = rawSug
				.slice(1)
				.map((r) => ({
					Date: r[0] || '',
					TimeSlot: r[2] || '',
					FirstName: (r[3] || '').trim(),
					LastName: (r[4] || '').trim(),
					EmailAddress: (r[5] || '').trim(),
					SignUpComment: r[6] || '',
					SignUpTimestamp: r[7] || '',
					OrderSpecificItems: r[8] || ''
				}))
				.filter((r) => r.FirstName && r.LastName);

			

			function findColumnIndex(rawEtap: string[][], columnName: string): number {
				const index = rawEtap[0].findIndex(colName => colName.toLowerCase().includes(columnName.toLowerCase()));
				if (index === -1) {
					throw new Error(`Etapestry report is missing column for "${columnName}"`);
				}
				return index;
			}

			let colidx_AccountNumber: number = findColumnIndex(rawEtap, 'account number');
			let colidx_LastName: number = findColumnIndex(rawEtap, 'last name');
			let colidx_FirstName: number = findColumnIndex(rawEtap, 'first name');
			let colidx_NumFoodPantryHouseholdMembers: number = findColumnIndex(rawEtap, 'total # of fp members in household');
			let colidx_NumFoodPantryElderMembers: number = findColumnIndex(rawEtap, '# of fp older adults in household');
			let colidx_NumFoodPantryAdultMembers: number = findColumnIndex(rawEtap, '# of fp adults in household');
			let colidx_NumFoodPantryTeenMembers: number = findColumnIndex(rawEtap, '# of fp teens in household');
			let colidx_NumFoodPantryChildrenMembers: number = findColumnIndex(rawEtap, '# of fp children in household');
			let colidx_PhoneNumber: number = findColumnIndex(rawEtap, 'phone');
			let colidx_EmailAddress: number = findColumnIndex(rawEtap, 'email');

			const etapRecords: EtapRecord[] = rawEtap
				.slice(2)
				.map((r) => ({
					AccountNumber: r[colidx_AccountNumber] || '',
					LastName: (r[colidx_LastName] || '').trim(),
					FirstName: (r[colidx_FirstName] || '').trim(),
					NumFoodPantryHouseholdMembers: r[colidx_NumFoodPantryHouseholdMembers] || '',
					NumFoodPantryElderMembers: r[colidx_NumFoodPantryElderMembers] || '',
					NumFoodPantryAdultMembers: r[colidx_NumFoodPantryAdultMembers] || '',
					NumFoodPantryTeenMembers: r[colidx_NumFoodPantryTeenMembers] || '',
					NumFoodPantryChildrenMembers: r[colidx_NumFoodPantryChildrenMembers] || '',
					PhoneNumber: r[colidx_PhoneNumber] || '',
					EmailAddress: (r[colidx_EmailAddress] || '').trim()
				}))
				.filter((r) => r.FirstName && r.LastName);
			
			// 3) Merge
			let merged: MergedRecord[] = [];

			for (let sug of sugRecords) {
				let match: MergedRecord = {
					sug: sug,
					etap: etapRecords.find(etap => (etap.EmailAddress === sug.EmailAddress) || (sug.FirstName === etap.FirstName && sug.LastName === etap.LastName))
				};

				merged.push(match);
			}

			// 4) Sort by signup date/time
			function parseDateSlot(s?: SugRecord) {
				if (!s) {
					return { date: 0, time: 0 };
				}

				const [m, d, y] = s.Date.split('/').map(Number);
				const date = new Date(y, m - 1, d).getTime();

				// timeSlot like "3:04 pm - 4:04 pm"
				const ts = s.TimeSlot.split('-')[0].trim();
				const dt = new Date(`1970-01-01 ${ts}`);
				const time = dt.getTime();
				return { date, time };
			}

			merged.sort((a, b) => {
				const da = parseDateSlot(a.sug);
				const db = parseDateSlot(b.sug);

				return da.date === db.date ? da.time - db.time : da.date - db.date;
			});

			// 5) Build CSV outputs
			const mergedRows: string[][] = [
				[
					'Account Number',
					'Last Name / Head of Household',
					'First Name',
					'Total # of FP members in Household',
					'# of FP Older Adults in Household - 65 & older',
					'# of FP Adults in Household',
					'# of FP Teens in Household - 12-18 yrs old',
					'# of FP Children in Household - 11 and under',
					'Found in Etapestry'
				]
			];

			const rosterRows: string[][] = [
				[
					'Account Number',
					'Date',
					'Time',
					'Last Name',
					'First Name',
					'Phone',
					'Total # of FP members in Household',
					'# of FP Older Adults in Household - 65 & older',
					'# of FP Adults in Household',
					'# of FP Teens in Household - 12-18 yrs old',
					'# of FP Children in Household - 11 and under',
					'Comments'
				]
			];

			for (const { etap, sug } of merged) {
				const found = etap ? 'Yes' : 'No';

				if (etap) {
					rosterRows.push([
						etap.AccountNumber, // Account Number
						sug.Date,
						sug.TimeSlot,
						sug.LastName,
						sug.FirstName,
						etap.PhoneNumber,
						etap.NumFoodPantryHouseholdMembers,
						etap.NumFoodPantryElderMembers,
						etap.NumFoodPantryAdultMembers,
						etap.NumFoodPantryTeenMembers,
						etap.NumFoodPantryChildrenMembers,
						[sug.SignUpComment, sug.OrderSpecificItems].filter(Boolean).join('; ')
					]);

					mergedRows.push([
						etap.AccountNumber,
						sug.LastName,
						sug.FirstName,
						etap.NumFoodPantryHouseholdMembers,
						etap.NumFoodPantryElderMembers,
						etap.NumFoodPantryAdultMembers,
						etap.NumFoodPantryTeenMembers,
						etap.NumFoodPantryChildrenMembers,
						found
					]);
				} else {
					rosterRows.push([
						"Not in Etapestry - No Account Number",
						sug.Date,
						sug.TimeSlot,
						sug.LastName,
						sug.FirstName,
						"Not in Etapestry - No Phone Number",
						"Not in Etapestry - No Total # of FP members in Household",
						"Not in Etapestry - No # of FP Older Adults",
						"Not in Etapestry - No # of FP Adults",
						"Not in Etapestry - No # of FP Teens",
						"Not in Etapestry - No # of FP Children",
						[sug.SignUpComment, sug.OrderSpecificItems].filter(Boolean).join('; ')
					]);

					mergedRows.push([
						"Not in Etapestry - No Account Number",
						sug.LastName,
						sug.FirstName,
						"Not in Etapestry - No Total # of FP members in Household",
						"Not in Etapestry - No # of FP Older Adults",
						"Not in Etapestry - No # of FP Adults",
						"Not in Etapestry - No # of FP Teens",
						"Not in Etapestry - No # of FP Children",
						found
					]);
				}
			}

			// 6) Prepare CSV data for download
			mergedCsvData = Papa.unparse(mergedRows);
			rosterCsvData = Papa.unparse(rosterRows);

			// Show success and download buttons
			isProcessing = false;
			showDownloads = true;
		} catch (error) {
			isProcessing = false;
			console.error(error);
			alert('Error processing files: ' + error);
		}
	}

	function downloadMerged() {
		downloadCsv('merged.csv', mergedCsvData);
	}

	function downloadRoster() {
		downloadCsv('roster.csv', rosterCsvData);
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-200">
	<div class="w-full max-w-md rounded-lg bg-white px-5 py-8 shadow">
		<h2 class="mb-4 text-center text-2xl font-bold">Merge SignUpGenius and Etapestry Reports</h2>

		{#if !showDownloads}
			<form on:submit={handleSubmit} class="space-y-4">
				<div>
					<label for="etapestryReport" class="block text-sm font-bold text-gray-700">
						Etapestry Report
					</label>
					<div class="mt-1">
						<input
							type="file"
							name="etapestryReport"
							id="etapestryReport"
							class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							disabled={isProcessing}
							accept=".xlsx,.xls,.csv"
						/>
					</div>
				</div>

				<div>
					<label for="signUpGeniusReport" class="block text-sm font-bold text-gray-700">
						SignUp Genius Report
					</label>
					<div class="mt-1">
						<input
							type="file"
							name="signUpGeniusReport"
							id="signUpGeniusReport"
							class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							disabled={isProcessing}
							accept=".xlsx,.xls,.csv"
						/>
					</div>
				</div>

				<div>
					<button
						type="submit"
						class="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={isProcessing}
					>
						{#if isProcessing}
							<svg
								class="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							Processing...
						{:else}
							Merge Reports
						{/if}
					</button>
				</div>

				<p class="text-center text-sm">v{version}</p>
			</form>
		{/if}

		{#if showDownloads}
			<div class="space-y-4">
				<div class="flex items-center justify-center rounded-md bg-green-50 p-4">
					<svg
						class="mr-2 h-5 w-5 text-green-400"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clip-rule="evenodd"
						/>
					</svg>
					<span class="text-sm font-medium text-green-800">Reports merged successfully!</span>
				</div>

				<div class="space-y-3">
					<button
						on:click={downloadMerged}
						class="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
					>
						<svg
							class="mr-2 h-4 w-4"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						Download Merged Report
					</button>

					<button
						on:click={downloadRoster}
						class="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
					>
						<svg
							class="mr-2 h-4 w-4"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						Download Roster Report
					</button>
				</div>

				<div class="pt-2">
					<button
						on:click={() => {
							showDownloads = false;
							mergedCsvData = '';
							rosterCsvData = '';
						}}
						class="inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
					>
						Process New Files
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
