import { XMLParser } from 'fast-xml-parser';

interface WSDLMessagePart {
	'@_name': string;
	'@_type': string;
}

interface WSDLMessage {
	'@_name': string;
	part?: WSDLMessagePart[] | WSDLMessagePart;
}

interface WSDLOperation {
	'@_name': string;
	'@_parameterOrder': string;
	input: { '@_message': string };
	output: { '@_message': string };
}

interface SequenceElement {
	'@_name': string;
	'@_type': string;
}

interface ArrayData {
	'@_ref': string;
	'@_wsdl:arrayType': string;
}

interface WSDLType {
	'@_name': string;
	'sequence'?: { element: SequenceElement[] };
	'complexContent'?: { restriction: { attribute: ArrayData } };
}

interface TypeNamespace {
	'@_targetNamespace': string;
	complexType: WSDLType[] | WSDLType;
}

interface EtApiWSDL {
	definitions: {
		'portType': { operation: WSDLOperation[] };
		message: WSDLMessage[];
		types: { schema: TypeNamespace[] };
	};
}

interface SoapFault {
	faultcode: string;
	faultstring: string;
}

interface EtApiResponse {
	"SOAP-ENV:Envelope"?: {
		"SOAP-ENV:Body": {
			"SOAP-ENV:Fault": SoapFault;
			[key: string]: any;
		};
	};
	"env:Envelope"?: {
		"env:Body": {
			[key: string]: any;
		}
	}
}

export class EtApiClient {
	private wsdl!: EtApiWSDL;
	private timeoutMs: number;
	private cookies: Record<string, string>;

	constructor(private wsdlEndpoint: string, private timeoutMs: number = 15000) {
		this.timeoutMs = timeoutMs;
		this.cookies = {};
	}

	/** Fetch and parse the WSDL */
	async init(): Promise<void> {
		const res = await fetch(this.wsdlEndpoint, {
			method: 'GET',
			headers: {
				'Accept': 'text/xml,*/*',
				'Connection': 'Close'
			},
			credentials: 'include',
			signal: AbortSignal.timeout(this.timeoutMs)
		});

		if (!res.ok) {
			throw new Error(`Unexpected status: ${res.status}`);
		}

		const xml = await res.text();
		const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
		this.wsdl = parser.parse(xml) as EtApiWSDL;
	}

	getOperations(): WSDLOperation[] {
		return this.wsdl.definitions.portType.operation;
	}

	getMessages(): WSDLMessage[] {
		return this.wsdl.definitions.message;
	}

	getTypeNamespaces(): TypeNamespace[] {
		return this.wsdl.definitions.types.schema;
	}

	getOperation(name: string): WSDLOperation | undefined {
		return this.getOperations().find(op => op['@_name'] === name);
	}

	getMessage(name: string): WSDLMessage | undefined {
		return this.getMessages().find(msg => msg['@_name'] === name);
	}

	getType(name: string): WSDLType | undefined {
		for (const ns of this.getTypeNamespaces()) {
			if (!Array.isArray(ns.complexType)) {
				ns.complexType = [ns.complexType];
			}
			
			const match = ns.complexType.find(ct => ct['@_name'] === name);

			if (match) {
				return match;
			}
		}
	}

	/** Recursively build a single XML element */
	private buildElement(tag: string, type: string, value: any): string {
		if (value == null) {
			return '';
		}

		// simple types
		if (["string", "int", "double", "boolean", "dateTime"].includes(type)) {
			return this.buildElement(tag, `xsd:${type}`, value);
		}

		// xsd primitives
		if (["xsd:string", "xsd:int", "xsd:double", "xsd:boolean"].includes(type)) {
			let text = '';

			switch (typeof value) {
				case 'string':
				case 'number':
				case 'boolean':
					text = value.toString();
					break;

				default:
					text = String(value);
			}

			return `<${tag} xsi:type="${type}">${text}</${tag}>`;
		}

		if (type === "xsd:dateTime") {
			return `<${tag} xsi:type="xsd:dateTime">${(value as Date).toISOString()}</${tag}>`;
		}

		// complexType (tns:)
		if (type.startsWith('tns:')) {
			const typeName = type.replace(/^tns:/, '');
			const wsdlType = this.getType(typeName)!;

			// arrays
			const arrAttr = wsdlType.complexContent?.restriction.attribute['@_wsdl:arrayType'] || '';

			if (arrAttr) {
				const itemType = arrAttr.replace(/\[\]$/, '');
				const items = (value as any[]).map(v => this.buildElement('item', itemType, v)).join('');

				return `<${tag} xmlns="" xsi:type="SOAP-ENC:Array" SOAP-ENC:arrayType="${itemType}[${(value as any[]).length}]">${items}</${tag}>`;
			}

			// object
			const elems = wsdlType.sequence?.element.map(el => {
				return this.buildElement(el['@_name'], el['@_type'], (value as any)[el['@_name']]);
			}).join('') || '';

			return `<${tag} xsi:type="${type}">${elems}</${tag}>`;
		}

		return '';
	}

	/** Core SOAP call */
	async call<T = any>(method: string, args: any[]): Promise<T> {
		const op = this.getOperation(method);

		if (!op) {
			throw new Error(`Operation ${method} not found`);
		}

		// build the inner request XML
		const msgFullName = op.input['@_message'].replace(/^tns:/, '');
		const msg = this.getMessage(msgFullName)!;
		const tag = `tns:${method}`;

		let bodyInner = `<${tag} xmlns:tns="etapestryAPI/service">`;

		if (msg.part) {
			if (Array.isArray(msg.part)) {
				msg.part.forEach((p, i) => {
					bodyInner += this.buildElement(p['@_name'], p['@_type'], args[i]);
				});
			} else {
				bodyInner += this.buildElement(msg.part['@_name'], msg.part['@_type'], args[0]);
			}
		}

		bodyInner += `</${tag}>`;

		let xmlBody = `<?xml version="1.0" encoding="ISO-8859-1"?>
<SOAP-ENV:Envelope SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"
	xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
	xmlns:xsd="http://www.w3.org/2001/XMLSchema"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" xmlns:tns="etapestryAPI/service">
	<SOAP-ENV:Body>
		${bodyInner}
	</SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

		xmlBody = xmlBody.replaceAll("\n", " ");
		xmlBody = xmlBody.replaceAll("\t", "");
		xmlBody = xmlBody.replaceAll("> ", ">");

		// perform the fetch
		const res = await fetch(this.wsdlEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'text/xml; charset="utf-8"',
				'SOAPAction': '\"\"',
				'Cookie': Object.entries(this.cookies).map(([name, value]) => `${name}=${value}`).join('; ')
			},
			body: xmlBody,
			credentials: 'include',
			signal: AbortSignal.timeout(this.timeoutMs)
		});
		const xml = await res.text();
		
		for (let [headerKey, headerValue] of res.headers.entries()) {
			if (headerKey !== 'set-cookie') {
				continue;
			}

			const cookie = headerValue.split(';')[0]!;
			const [name, value] = cookie.split('=');
			this.cookies[name!] = value!;
		}

		// parse response
		const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
		const json = parser.parse(xml) as EtApiResponse;

		if (json['SOAP-ENV:Envelope']) {
			const fault = json['SOAP-ENV:Envelope']['SOAP-ENV:Body']['SOAP-ENV:Fault'];
			
			throw new Error(`SOAP Fault: ${fault.faultstring} [${fault.faultcode}]`);
		}

		// strip outer Body tag and return the inner object
		return json['env:Envelope']!['env:Body'] as T;
	}
}

export class EtApiSimpleClient {
	private client: EtApiClient;

	private constructor(client: EtApiClient) {
		this.client = client;
	}

	static async login(databaseId: string, apiKey: string): Promise<EtApiSimpleClient> {
		let endpoint = 'https://bos.etapestry.com/v3messaging/service?WSDL';

		while (true) {
			const c = new EtApiClient(endpoint);
			await c.init();

			const resp = await c.call<{ result: string }>('apiKeyLogin', [databaseId, apiKey]);

			if (!resp.result) {
				return new EtApiSimpleClient(c);
			}

			endpoint = resp.result;
		}
	}

	async getAccountById(id: string) {
		return this.client.call<{ "ns0:Account": any }>('getAccountById', [id]);
	}

	async getAccountByVariousInfo(
		name: string,
		address: string,
		email: string,
		phone: string
	) {
		return this.client.call<{ "ns0:Account": any }>('getDuplicateAccount', [
			{
				name,
				address,
				email,
				phoneNumber: phone,
				allowEmailOnlyMatch: false,
				accountRoleTypes: 1,
			},
		]);
	}

	async addVolunteerHours(accountRef: string, hours: number, note: string) {
		const r = await this.client.call<{ result: string }>('addContact', [
			{
				accountRef,
				definedValues: [
					{
						fieldName: 'Volunteer Hours',
						fieldRef: '697.0.66122083',
						value: hours.toString(),
					},
				],
				method: 'Volunteer',
				note,
				subject: 'Volunteering',
			},
			false,
		]);
		return r.result;
	}

	async addMedicalLoan(
		accountRef: string,
		totalItemsBorrowed: string,
		equipmentBorrowed: string[],
		otherEquipmentBorrowed: string
	) {
		const defs = [
			{
				fieldName: 'Total # of Items Borrowed',
				fieldRef: '697.0.154026159',
				value: totalItemsBorrowed,
			},
			...equipmentBorrowed.map(e => ({
				fieldName: 'Equipment Type',
				fieldRef: '697.0.153974847',
				value: e,
			})),
		];
		const r = await this.client.call<{ result: string }>('addContact', [
			{
				accountRef,
				definedValues: defs,
				method: 'Borrowed Medical Equipment',
				note: `Imported automatically\nOther equipment borrowed (if any): ${otherEquipmentBorrowed}`,
				subject: 'Medical Equipment Loan',
			},
			false,
		]);
		return r.result;
	}

	async getDefinedField(name: string) {
		return this.client.call<any>('getDefinedField', [name, false]);
	}

	async close() {
		await this.client.call('logout', []);
	}
}
