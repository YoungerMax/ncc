import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

document.title = `Volunteer Scanner v${chrome.runtime.getManifest().version}`;

const app = mount(App, {
	target: document.getElementById('app')!,
});

export default app;
