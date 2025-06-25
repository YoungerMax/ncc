<script lang="ts">
	import { enhance } from '$app/forms';
	import { version } from './constants';
	import Kiosk from './Kiosk.svelte';
	let success = false;
	let kioskMode = false;
</script>

<svelte:head>
	<link rel="manifest" href="/volunteer-scanner/manifest.json" />
</svelte:head>

{#if kioskMode}
	<Kiosk />
{:else}
	<div class="flex h-screen w-full items-center justify-center">
		<div class="rounded-xl bg-gray-700 p-8">
			<h1 class="mb-4 text-4xl font-bold">Volunteer Scanner Dashboard</h1>

			<form
				method="POST"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							success = true;
							await update();

							setTimeout(() => {
								success = false;
							}, 3000);
						}
					};
				}}
			>
				<div class="mb-4">
					<label class="mb-2 block text-sm font-bold" for="etapestryDatabaseId">
						Database ID
					</label>
					<input
						class="w-full rounded bg-gray-500 px-3 py-2 shadow"
						id="etapestryDatabaseId"
						type="text"
						placeholder="Database ID"
						name="etapestryDatabaseId"
					/>
				</div>
				<div class="mb-6">
					<label class="mb-2 block text-sm font-bold" for="etapestryApiKey"> API Key </label>
					<input
						class="w-full rounded bg-gray-500 px-3 py-2 shadow"
						id="etapestryApiKey"
						type="password"
						placeholder="API Key"
						name="etapestryApiKey"
					/>
				</div>
				<div class="flex items-center justify-between">
					<div>
						<button
							class="focus:shadow-outline cursor-pointer rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-600 focus:outline-none"
							type="submit"
						>
							Save
						</button>
						{#if success}
							<p class="ml-2 inline-block text-sm italic text-green-500">Saved!</p>
						{/if}
					</div>
					<button
						class="focus:shadow-outline mb-4 cursor-pointer rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-600 focus:outline-none"
						onclick={() => {
							kioskMode = true;
							document.documentElement.requestFullscreen({ navigationUI: 'hide' });
						}}
					>
						Start Kiosk Mode
					</button>
				</div>
				<p class="text-right font-light">v{version}</p>
			</form>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		background: #1f2937;
		color: #fff;
		font-family: 'Inter', sans-serif;
	}
</style>