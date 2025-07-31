import Papa from 'papaparse';
import { createCsvUrl, findColumnIndex, parseSpreadsheet, type Artifact } from './lib';

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
		emptyTimeBlock: boolean;
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
	const sugRecords: SugRecord[] = rawSug.slice(1).map((r) => ({
		Date: r[0] || '',
		TimeSlot: r[2] || '',
		FirstName: (r[3] || '').trim(),
		LastName: (r[4] || '').trim(),
		EmailAddress: (r[5] || '').trim(),
		SignUpComment: r[6] || '',
		SignUpTimestamp: r[7] || '',
		OrderSpecificItems: r[8] || ''
	}));
	//		.filter((r) => r.FirstName && r.LastName);

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
		let mergedRecord: MergedRecord;

		if (sug.FirstName || sug.LastName || sug.EmailAddress) {
			const matchedEtap = etapRecords.find(
				(etap) =>
					etap.EmailAddress.toLowerCase() === sug.EmailAddress.toLowerCase() ||
					(sug.FirstName.toLowerCase() === etap.FirstName.toLowerCase() &&
						sug.LastName.toLowerCase() === etap.LastName.toLowerCase())
			);

			mergedRecord = { sug, etap: matchedEtap, emptyTimeBlock: false };
		} else {
			// Empty Time Block
			mergedRecord = { sug, etap: undefined, emptyTimeBlock: true };
		}

		merged.push(mergedRecord);
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

	for (const { etap, sug, emptyTimeBlock } of merged) {
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
		} else if (emptyTimeBlock) {
			rosterRows.push([
				'',
				sug.Date,
				sug.TimeSlot,
				sug.LastName,
				sug.FirstName,
				'',
				'',
				'',
				'',
				'',
				'',
				[sug.SignUpComment, sug.OrderSpecificItems].filter(Boolean).join('; ')
			]);

			mergedRows.push(['', sug.LastName, sug.FirstName, '', '', '', '', '', found]);
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
	const dates = rosterRows
		.map((x) => x[1])
		.filter((date, index, self) => index > 0 && self.indexOf(date) === index)
		.map((x) => new Date(x).toLocaleDateString(undefined, { dateStyle: 'full' }));
	const title = `Roster for ${dates.join(', ')}`;

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

	// Create Excel spreadsheet version of the roster printable
	const XLSX = await import('xlsx-js-style');

	// Helper to get or create a cell object from the worksheet by row and column index.
	// It ensures the cell object exists before attempting to apply styles.
	const getOrCreateCell = (worksheet: any, r: number, c: number, value?: any) => {
		const cellRef = XLSX.utils.encode_cell({ r, c });
		if (!worksheet[cellRef]) {
			// If cell doesn't exist, create it with an initial value (if provided)
			worksheet[cellRef] = { v: value !== undefined ? value : '' };
		}
		return worksheet[cellRef];
	};

	// Helper to apply nested style properties to a cell object.
	// It recursively ensures parent style objects exist (e.g., `cell.s`, `cell.s.font`)
	// before applying the final style properties.
	const applyCellStyles = (cell: any, styles: any) => {
		if (!cell.s) cell.s = {};
		for (const key in styles) {
			if (Object.prototype.hasOwnProperty.call(styles, key)) {
				const styleValue = styles[key];
				if (typeof styleValue === 'object' && styleValue !== null && !Array.isArray(styleValue)) {
					// If the style value is an object (e.g., 'font', 'alignment', 'fill'),
					// ensure the nested object exists and then merge properties into it.
					if (!cell.s[key]) cell.s[key] = {};
					Object.assign(cell.s[key], styleValue);
				} else {
					// Otherwise, it's a direct style property (e.g., 'numFmt' if applied directly to 's')
					cell.s[key] = styleValue;
				}
			}
		}
	};

	// Prepare data for Excel
	const excelData: string[][] = [];

	// Add title, summary, and an empty row for spacing
	excelData.push([title]);
	excelData.push([`Bags: ${numBags} | Boxes: ${numBoxes} | Unknown: ${numUnknown}`]);
	excelData.push([]);

	// Add headers and body rows
	excelData.push(printableHeaders);
	printableBody.forEach((row) => excelData.push(row));

	const worksheet = XLSX.utils.aoa_to_sheet(excelData);

	// Merge cells for title and summary to span across columns
	worksheet['!merges'] = [
		{ s: { r: 0, c: 0 }, e: { r: 0, c: printableHeaders.length - 1 } }, // Merge title
		{ s: { r: 1, c: 0 }, e: { r: 1, c: printableHeaders.length - 1 } } // Merge summary
	];

	// Apply styles to Title
	const titleCell = getOrCreateCell(worksheet, 0, 0, excelData[0][0]);
	applyCellStyles(titleCell, {
		font: { bold: true, sz: 16 },
		alignment: { horizontal: 'center', vertical: 'middle' }
	});

	// Apply styles to Summary
	const summaryCell = getOrCreateCell(worksheet, 1, 0, excelData[1][0]);
	applyCellStyles(summaryCell, {
		font: { bold: true, sz: 12 },
		alignment: { horizontal: 'center', vertical: 'middle' }
	});

	// Apply styles to Headers
	const headersRowIndex = 3; // The row containing headers (0-indexed in excelData and worksheet)
	for (let col = 0; col < printableHeaders.length; col++) {
		const headerCell = getOrCreateCell(
			worksheet,
			headersRowIndex,
			col,
			excelData[headersRowIndex][col]
		);
		applyCellStyles(headerCell, {
			font: { bold: true },
			alignment: { wrapText: true, vertical: 'top' }
		});
	}

	// Apply conditional formatting: yellow background for rows with 3+ family members
	const dataStartRowIndex = 4; // Body data starts at this 0-indexed row in excelData
	for (let i = 0; i < printableBody.length; i++) {
		const numFamilyMembersStr = printableBody[i][2]; // # of FM is at index 2 in printableBody row
		const numFamilyMembers = parseInt(numFamilyMembersStr, 10);

		if (!isNaN(numFamilyMembers) && numFamilyMembers >= 3) {
			const excelRowIndex = dataStartRowIndex + i;
			for (let col = 0; col < printableHeaders.length; col++) {
				const cell = getOrCreateCell(worksheet, excelRowIndex, col, excelData[excelRowIndex][col]);
				applyCellStyles(cell, {
					fill: { fgColor: { rgb: 'FFFFFF00' } }, // Yellow (AARRGGBB)
					font: { color: { rgb: 'FF000000' } } // Black text (AARRGGBB)
				});
			}
		}
	}

	// Set column widths for better presentation
	worksheet['!cols'] = [
		{ wch: 10 }, // Acct # (col 0)
		{ wch: 10 }, // Come? (col 1)
		{ wch: 8 }, // # of FM (col 2)
		{ wch: 15 }, // Time (col 3)
		{ wch: 15 }, // First Name (col 4)
		{ wch: 15 }, // Last Name (col 5)
		{ wch: 15 }, // Phone (col 6)
		{ wch: 20 } // Notes (col 7)
	];

	// Create a workbook and add the styled worksheet
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, 'Roster');

	// Generate Excel file as an ArrayBuffer and then a Blob URL
	const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
	const excelBlob = new Blob([excelBuffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	}); // Correct MIME type for .xlsx
	const excelBlobUrl = URL.createObjectURL(excelBlob);

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
			name: 'Roster Printable (PDF)',
			filename: 'roster.pdf',
			contentUrl: rosterPrintable.output('bloburl')
		},
		{
			name: 'Roster Printable (Excel)',
			filename: 'roster.xlsx',
			contentUrl: excelBlobUrl
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

	if (rawFile1[0].find((colName) => colName.toLowerCase().trim().includes('net amount'))) {
		rawBb = rawFile1;
	} else if (rawFile2[0].find((colName) => colName.toLowerCase().trim().includes('net amount'))) {
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

	return [
		{
			name: 'Merged Report',
			contentUrl: createCsvUrl(Papa.unparse(mergedRows)),
			filename: 'merged.csv'
		}
	] as Artifact[];
}
