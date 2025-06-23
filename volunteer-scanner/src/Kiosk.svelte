<script lang="ts">
    import { onMount } from "svelte";
    import logo from "./assets/images/logo.png";

    let topText = $state("Loading...");
    let bottomText = $state("Just a moment...");
    let timeoutId: number;

    function resetText() {
        topText = "Welcome!";
        bottomText = "Volunteers, please scan your barcode.";
    }

    async function scan(accountNumber: number): Promise<{ name: string, state: 'signedIn' | 'signedOut' } | { error: string }> {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { type: "scan", accountNumber },
                (response) => resolve(response),
            );
        });
    }

    onMount(resetText);
</script>

<form
    method="post"
    onsubmit={async (event) => {
        event.preventDefault();
        clearTimeout(timeoutId);

        const formData = new FormData(event.target as HTMLFormElement);
        const accountNumber = Number(formData.get("code"));
        
        topText = "Please wait...";
        bottomText = "We're updating our database. Please wait a moment.";

        const response = await scan(accountNumber);

        if ('error' in response) {
            topText = "Whoops, something went wrong.";
            bottomText = " Please scan again or sign in on the sheet.";
            return;
        }
        
        if (response.state === "signedIn") {
            topText = `Hi, ${response.name}!`
            bottomText = "You've just signed in. Remember to sign out when you leave.";
        } else if (response.state === "signedOut") {
            topText = `Goodbye, ${response.name}!`;
            bottomText = "You've just signed out. Thank you for volunteering at the Needham Community Council!";
        } else {
            topText = "Whoops, something went wrong.";
            bottomText = " Please scan again or sign in on the sheet.";
        }

        (event.target as HTMLFormElement).reset();
        timeoutId = setTimeout(resetText, 5000);
    }}
>
    <!-- Account Number -->
    <input
        type="number"
        autofocus={true}
        name="code"
        onblur={(event) => event.currentTarget.focus()}
    />
</form>

<main>
    <h1>{topText}</h1>
    <h2>{bottomText}</h2>
</main>

<div class="bottom">
    <img alt="Needham Community Council logo" id="logo" src={logo} />
    <p>v{chrome.runtime.getManifest().version}</p>
</div>
