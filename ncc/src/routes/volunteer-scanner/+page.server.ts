import { fail } from '@sveltejs/kit';
import { zfd } from 'zod-form-data';

const schema = zfd.formData({
    etapestryDatabaseId: zfd.text(),
    etapestryApiKey: zfd.text()
});

/** @type {import('./$types').Actions} */
export const actions = {
    default: async ({ cookies, request }) => {
        const formData = await request.formData();
        const result = schema.safeParse(formData);

        if (!result.success) {
            return fail(400, { message: "bad request" });
        }

        const { etapestryDatabaseId, etapestryApiKey } = result.data;
        cookies.set('etapestryDatabaseId', etapestryDatabaseId, { path: '/', expires: new Date(9999, 11, 31, 23, 59, 59, 999) });
        cookies.set('etapestryApiKey', etapestryApiKey, { path: '/', expires: new Date(9999, 11, 31, 23, 59, 59, 999) });

        return { success: true };
    }
};