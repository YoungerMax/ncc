import Papa from 'papaparse';
import { createCsvUrl, findColumnIndex, parseSpreadsheet, type Artifact } from './lib';
import { text } from 'zod-form-data';

export async function mergeEtapSug(file1: File, file2: File) {
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

	// 1) Read raw CSV arrays
	const [rawFile1, rawFile2] = await Promise.all([
		parseSpreadsheet(file1),
		parseSpreadsheet(file2)
	]);

	let rawSug: string[][];
	let rawEtap: string[][];

	if (rawFile1[0].find((colName) => colName.toLowerCase().trim().includes('account number'))) {
		rawEtap = rawFile1;
	} else if (
		rawFile2[0].find((colName) => colName.toLowerCase().trim().includes('account number'))
	) {
		rawEtap = rawFile2;
	} else {
		alert('Missing Etapestry spreadsheet. Are you sure you attached the correct file?');
		return [];
	}

	if (rawFile1[0].find((colName) => colName.toLowerCase().trim().includes('sign up comment'))) {
		rawSug = rawFile1;
	} else if (
		rawFile2[0].find((colName) => colName.toLowerCase().trim().includes('sign up comment'))
	) {
		rawSug = rawFile2;
	} else {
		alert('Missing SignUp Genius spreadsheet. Are you sure you attached the correct file?');
		return [];
	}

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

	const colidx_AccountNumber: number = findColumnIndex(rawEtap[0], 'account number');
	const colidx_LastName: number = findColumnIndex(rawEtap[0], 'last name');
	const colidx_FirstName: number = findColumnIndex(rawEtap[0], 'first name');
	const colidx_NumFoodPantryHouseholdMembers: number = findColumnIndex(
		rawEtap[0],
		'total # of fp members in household'
	);
	const colidx_NumFoodPantryElderMembers: number = findColumnIndex(
		rawEtap[0],
		'# of fp older adults in household'
	);
	const colidx_NumFoodPantryAdultMembers: number = findColumnIndex(
		rawEtap[0],
		'# of fp adults in household'
	);
	const colidx_NumFoodPantryTeenMembers: number = findColumnIndex(
		rawEtap[0],
		'# of fp teens in household'
	);
	const colidx_NumFoodPantryChildrenMembers: number = findColumnIndex(
		rawEtap[0],
		'# of fp children in household'
	);
	const colidx_PhoneNumber: number = findColumnIndex(rawEtap[0], 'phone');
	const colidx_EmailAddress: number = findColumnIndex(rawEtap[0], 'email');

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
	const merged: MergedRecord[] = [];

	for (const sug of sugRecords) {
		const match: MergedRecord = {
			sug: sug,
			etap: etapRecords.find(
				(etap) =>
					etap.EmailAddress === sug.EmailAddress ||
					(sug.FirstName === etap.FirstName && sug.LastName === etap.LastName)
			)
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
				'N/A',
				sug.Date,
				sug.TimeSlot,
				sug.LastName,
				sug.FirstName,
				'N/A',
				'N/A',
				'N/A',
				'N/A',
				'N/A',
				'N/A',
				[sug.SignUpComment, sug.OrderSpecificItems].filter(Boolean).join('; ')
			]);

			mergedRows.push([
				'N/A',
				sug.LastName,
				sug.FirstName,
				'N/A',
				'N/A',
				'N/A',
				'N/A',
				'N/A',
				found
			]);
		}
	}

	const { jsPDF } = await import('jspdf');

	const rosterPrintable = new jsPDF({ orientation: 'landscape' });
	const title = `Roster for ${new Date().toLocaleDateString(undefined, { dateStyle: 'full' })}`;

	rosterPrintable.setDocumentProperties({ title });
	rosterPrintable.setFontSize(24);
	rosterPrintable.text(title, 14, 15);

	let numBags = 0;
	let numBoxes = 0;
	let numUnknown = 0;

	for (const entry of merged) {
		if (entry.etap) {
			if (parseInt(entry.etap.NumFoodPantryHouseholdMembers) >= 3) {
				numBoxes++;
			} else {
				numBags++;
			}
		} else {
			numUnknown++;
		}
	}

	rosterPrintable.setFontSize(17);
	rosterPrintable.text(`Bags: ${numBags} | Boxes: ${numBoxes} | Unknown: ${numUnknown}`, 14, 22);

	const { autoTable } = await import('jspdf-autotable');

	const printableHeaders = [
		'Acct #',
		'Come?',
		'# of FM',
		'Time',
		'First Name',
		'Last Name',
		'Phone',
		'Notes'
	];

	const printableBody = rosterRows.slice(1).map((row) => {
		// Per rosterRows definition:
		// row[0] = Account Number
		// row[2] = Time
		// row[3] = Last Name
		// row[4] = First Name
		// row[5] = Phone
		// row[6] = Total # of FP members in Household
		return [
			row[0], // Acct #
			'', // Come?
			row[6], // # of FM
			row[2], // Time
			row[4], // First Name
			row[3], // Last Name
			row[5], // Phone
			'' // Notes
		];
	});

	autoTable(rosterPrintable, {
		startY: 25,
		head: [printableHeaders],
		body: printableBody,
		theme: 'grid',
		columnStyles: {
			0: { cellWidth: 17 },
			1: { cellWidth: 17 },
			2: { cellWidth: 17 },
			3: { cellWidth: 40 },
			4: { cellWidth: 35 },
			5: { cellWidth: 35 },
			6: { cellWidth: 35 }
		},
		didParseCell: (data: any) => {
			if (data.section !== 'body') return;

			// # of FM is at index 2 of our printableBody row
			const numFamilyMembersStr = (data.row.raw as string[])[2];
			const numFamilyMembers = parseInt(numFamilyMembersStr, 10);

			if (!isNaN(numFamilyMembers) && numFamilyMembers >= 3) {
				data.cell.styles.fillColor = '#ffff00'; // Yellow
			} else {
				data.cell.styles.fillColor = '#ffffff'; // White
			}
			// ensure text is black for readability on both white and yellow backgrounds
			data.cell.styles.textColor = '#000000';
		}
	});

	return [
		{
			name: 'Merged Report',
			contentUrl: createCsvUrl(Papa.unparse(mergedRows)),
			filename: 'merged.csv'
		},
		{
			name: 'Roster Report',
			contentUrl: createCsvUrl(Papa.unparse(rosterRows)),
			filename: 'roster.csv'
		},
		{
			name: 'Roster Printable',
			filename: 'roster.pdf',
			contentUrl: rosterPrintable.output('bloburl')
		}
	] as Artifact[];
}

export async function mergeEtapBb(file1: File, file2: File) {
	// 1) Read raw CSV arrays
	const [rawFile1, rawFile2] = await Promise.all([
		parseSpreadsheet(file1),
		parseSpreadsheet(file2)
	]);

	let rawEtap: string[][];
	let rawBb: string[][];

	if (rawFile1[0].find((colName) => colName.toLowerCase().trim().includes('gift type'))) {
		rawEtap = rawFile1;
	} else if (rawFile2[0].find((colName) => colName.toLowerCase().trim().includes('gift type'))) {
		rawEtap = rawFile2;
	} else {
		alert('Missing Etapestry spreadsheet. Are you sure you attached the correct file?');
		return [];
	}

	if (rawFile1[0].find((colName) => colName.toLowerCase().trim().includes('transaction id'))) {
		rawBb = rawFile1;
	} else if (
		rawFile2[0].find((colName) => colName.toLowerCase().trim().includes('transaction id'))
	) {
		rawBb = rawFile2;
	} else {
		alert('Missing Blackbaud spreadsheet. Are you sure you attached the correct file?');
		return [];
	}

	// 2) Build typed arrays (skip headers/empty rows)
	const colidx_etap_authCode: number = findColumnIndex(rawEtap[0], 'authorization code');
	const colidx_bb_authCode: number = findColumnIndex(rawBb[0], 'authorization code');

	// 5) Build CSV outputs
	let mergedRows: string[][] = [[...rawEtap[0], ...rawBb[0]]];

	for (let etapRowIdx = 2; rawEtap.length > etapRowIdx; etapRowIdx++) {
		let matchFound = false;

		for (let bbRowIdx = 1; rawBb.length > bbRowIdx; bbRowIdx++) {
			if (rawBb[bbRowIdx][colidx_bb_authCode] == rawEtap[etapRowIdx][colidx_etap_authCode]) {
				mergedRows.push([...rawEtap[etapRowIdx], ...rawBb[bbRowIdx]]);
				matchFound = true;
				break;
			}
		}

		if (!matchFound) {
			mergedRows.push([...rawEtap[etapRowIdx], ...[]]);
		}
	}

	const keepColIdxs = [
		'date',
		'account name',
		'received',
		'fee amount',
		'net amount',
		'type',
		'fund',
		'campaign',
		'approach',
		'payment type under user defined fields'
	].map((colName) => findColumnIndex(mergedRows[0], colName));

	mergedRows = mergedRows.map((row) => {
		return keepColIdxs.map((colIdx) => row[colIdx]);
	});

	// function parseDateSlot(s?: SugRecord) {
	// 	if (!s) {
	// 		return { date: 0, time: 0 };
	// 	}

	// 	const [m, d, y] = s.Date.split('/').map(Number);
	// 	const date = new Date(y, m - 1, d).getTime();

	// 	// timeSlot like "3:04 pm - 4:04 pm"
	// 	const ts = s.TimeSlot.split('-')[0].trim();
	// 	const dt = new Date(`1970-01-01 ${ts}`);
	// 	const time = dt.getTime();
	// 	return { date, time };
	// }

	// merged.sort((a, b) => {
	// 	const da = parseDateSlot(a.sug);
	// 	const db = parseDateSlot(b.sug);

	// 	return da.date === db.date ? da.time - db.time : da.date - db.date;
	// });

	return [
		{
			name: 'Merged Report',
			contentUrl: createCsvUrl(Papa.unparse(mergedRows)),
			filename: 'merged.csv'
		}
	] as Artifact[];
}
