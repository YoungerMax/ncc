import { z } from 'zod';
import { EtApiSimpleClient } from '../../../../../etapestry-client/index';
import { error, json } from '@sveltejs/kit';
import { forgotToSignOutGrantHours } from '../constants';

const RequestSchema = z.object({
    accountNumber: z.number(),
    hours: z.number().optional(),
    isForgot: z.boolean()
});

export const POST = async (event) => {
    const request = await RequestSchema.safeParseAsync(await event.request.json());
    
    if (request.error) {
        return error(400, { message: "bad request" });
    }

    const etapestryDatabaseId = event.cookies.get('etapestryDatabaseId');
    const etapestryApiKey = event.cookies.get('etapestryApiKey');

    if (!etapestryDatabaseId) {
        return error(400, { message: "missing database id" });
    }

    if (!etapestryApiKey) {
        return error(400, { message: "missing database id" });
    }

    if (!request.data.isForgot && request.data.hours === undefined) {
        return error(400, { message: "expected hours when not forgotten" });
    }
    
    const client = await EtApiSimpleClient.login(etapestryDatabaseId, etapestryApiKey);
    const account = await client.getAccountById(request.data.accountNumber.toString());
    const accountName = account['ns0:Account']['longSalutation']['#text'];
    const accountRef = account['ns0:Account']['ref']['#text'];

    if (request.data.isForgot) {
        await client.addVolunteerHours(accountRef, forgotToSignOutGrantHours, `Imported automatically (NOTE: this person forgot to sign out, so they were awarded ${forgotToSignOutGrantHours} hours of volunteer time).`);
    } else {
        await client.addVolunteerHours(accountRef, request.data.hours as number, "Imported automatically.");
    }

    return json({ accountName });
};