import { read } from 'xlsx';
import Papa from 'papaparse';

export interface Artifact {
	contentUrl: string;
	filename: string;
	name: string;
}

export async function parseSpreadsheet(file: File): Promise<string[][]> {
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

export function createCsvUrl(csvData: string) {
	const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	return url;
}

export function downloadCsv(filename: string, url: string) {
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export function findColumnIndex(speadsheetColumnNames: string[], columnName: string): number {
	const index = speadsheetColumnNames.findIndex((colName) =>
		colName.toLowerCase().includes(columnName.toLowerCase())
	);
	if (index === -1) {
		throw new Error(`Etapestry report is missing column for "${columnName}"`);
	}
	return index;
}
