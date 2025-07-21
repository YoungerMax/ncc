import { z } from 'zod';
import { EtApiSimpleClient } from '../../../../../etapestry-client/index';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const RequestSchema = z.object({
	accountNumber: z.number()
});

export const POST: RequestHandler = async (event) => {
	const request = await RequestSchema.safeParseAsync(await event.request.json());

	if (request.error) {
		return error(400, { message: 'bad request' });
	}

	const etapestryDatabaseId = event.cookies.get('etapestryDatabaseId');
	const etapestryApiKey = event.cookies.get('etapestryApiKey');

	if (!etapestryDatabaseId) {
		return error(400, { message: 'missing database id' });
	}

	if (!etapestryApiKey) {
		return error(400, { message: 'missing database id' });
	}

	const client = await EtApiSimpleClient.login(etapestryDatabaseId, etapestryApiKey);
	const account = await client.getAccountById(request.data.accountNumber.toString());
	const accountName = account['ns0:Account']['longSalutation']['#text'];

	return json({ accountName });
};
