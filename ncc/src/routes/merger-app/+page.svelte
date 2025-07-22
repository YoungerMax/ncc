<script lang="ts">
	import { version } from './constants';
	import { downloadCsv, type Artifact } from './lib';
	import { mergeEtapBb, mergeEtapSug } from './merge';

	let isProcessing = $state(false);
	let showDownloads = $state(false);
	let artifacts: Artifact[] = $state([]);

	export async function handleSubmit(
		event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }
	) {
		event.preventDefault();
		const form = event.currentTarget;
		const mergeMode = (form.mergeMode as HTMLSelectElement).value;
		const file1 = (form.file1 as HTMLInputElement).files?.[0];
		const file2 = (form.file2 as HTMLInputElement).files?.[0];

		if (!file1 || !file2) {
			alert('Both files are required');
			return;
		}

		isProcessing = true;
		showDownloads = false;

		try {
			// Show success and download buttons
			switch (mergeMode) {
				case 'mergeEtapSug':
					artifacts = await mergeEtapSug(file1, file2);
					break;

				case 'mergeEtapBb':
					artifacts = await mergeEtapBb(file1, file2);
					break;

				default:
					alert('Hmm, this merge mode is invalid.');
					break;
			}

			isProcessing = false;
			showDownloads = true;
		} catch (error) {
			isProcessing = false;
			console.error(error);
			alert('Error processing files: ' + error);
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-200">
	<div class="w-full max-w-md rounded-lg bg-white px-5 py-8 shadow">
		<h2 class="mb-4 text-center text-2xl font-bold">Merge Reports</h2>

		{#if !showDownloads}
			<form onsubmit={handleSubmit} class="space-y-4">
				<div>
					<label for="mergeMode" class="block text-sm font-bold text-gray-700"> Merge Mode </label>
					<div class="mt-1">
						<select
							name="mergeMode"
							id="mergeMode"
							class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							disabled={isProcessing}
						>
							<option value="mergeEtapSug">Etapestry and SignUp Genius</option>
							<option value="mergeEtapBb">Etapestry and Blackbaud</option>
						</select>
					</div>
				</div>

				<div>
					<label for="file1" class="block text-sm font-bold text-gray-700"> File 1 </label>
					<div class="mt-1">
						<input
							type="file"
							name="file1"
							id="file1"
							class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							disabled={isProcessing}
							accept=".xlsx,.xls,.csv"
						/>
					</div>
				</div>

				<div>
					<label for="file2" class="block text-sm font-bold text-gray-700"> File 2 </label>
					<div class="mt-1">
						<input
							type="file"
							name="file2"
							id="file2"
							class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							disabled={isProcessing}
							accept=".xlsx,.xls,.csv"
						/>
					</div>
				</div>

				<div>
					<button
						type="submit"
						class="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						disabled={isProcessing}
					>
						{#if isProcessing}
							<svg
								class="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
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
		{:else}
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
					{#each artifacts as artifact (artifact.name)}
						<button
							onclick={() => downloadCsv(artifact.filename, artifact.content)}
							class="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none"
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
							Download {artifact.name}
						</button>
					{/each}
				</div>

				<div class="pt-2">
					<button
						onclick={() => {
							showDownloads = false;
							artifacts = [];
						}}
						class="inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
					>
						Process New Files
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
