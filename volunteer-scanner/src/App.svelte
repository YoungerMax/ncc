<script lang="ts">
    import Kiosk from "./Kiosk.svelte";

    const isKioskMode = location.hash === '#kiosk';

    function startKioskMode() {
        chrome.windows.create({
            focused: true,
            state: 'fullscreen',
            url: chrome.runtime.getURL("index.html") + "#kiosk"
        });
    }

    function enterEtapestryDatabaseId() {
        chrome.storage.local.set({
            etapestryDatabaseId: prompt('Enter Etapestry Database ID:') ?? ""
        })
        .then(() => alert('✅ Successfully set Etapestry Database ID.'))
        .catch((err) => alert('❌ Something went wrong: ' + err));
    }

    function enterEtapestryApiKey() {
        chrome.storage.local.set({
            etapestryApiKey: prompt('Enter Etapestry API Key:') ?? ""
        })
        .then(() => alert('✅ Successfully set Etapestry API Key.'))
        .catch((err) => alert('❌ Something went wrong: ' + err));
    }
</script>

{#if isKioskMode}
    <Kiosk />
{:else}
    <h1>Kiosk</h1>
    <p>{chrome.runtime.getManifest().name}</p>
    <p>Version {chrome.runtime.getManifest().version}</p>
    <button onclick={startKioskMode}>Start Kiosk Mode</button>

    <h1>Settings</h1>
    <button onclick={enterEtapestryDatabaseId}>Set Etapestry Database ID</button>
    <button onclick={enterEtapestryApiKey}>Set Etapestry API Key</button>
{/if}
