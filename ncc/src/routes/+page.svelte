<script>
	import { onMount } from 'svelte';
	
	const tools = [
		{
			title: 'Volunteer Scanner Kiosk',
			description: 'Quick and easy volunteer check-in system for events and activities. Streamline volunteer tracking with barcode scanning capabilities.',
			href: '/volunteer-scanner',
			icon: '👥',
			color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
			buttonColor: 'bg-blue-600 hover:bg-blue-700'
		},
		// {
		// 	title: 'Medical Equipment Form Kiosk',
		// 	description: 'Digital form system for medical equipment requests and tracking. Simplify the process of managing medical equipment loans.',
		// 	href: '/medical-equipment-form',
		// 	icon: '🏥',
		// 	color: 'bg-green-50 border-green-200 hover:bg-green-100',
		// 	buttonColor: 'bg-green-600 hover:bg-green-700'
		// },
		{
			title: 'Etapestry and SignUpGenius Report Merger',
			description: 'Merge and reconcile data from Etapestry and SignUpGenius reports. Generate comprehensive volunteer rosters and attendance reports.',
			href: '/merger-app',
			icon: '📊',
			color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
			buttonColor: 'bg-purple-600 hover:bg-purple-700'
		}
	];

	let mounted = false;
	
	onMount(() => {
		mounted = true;
	});
</script>

<svelte:head>
	<title>Needham Community Council Tools</title>
	<meta name="description" content="Digital tools and kiosks for Needham Community Council operations">
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
	<!-- Header -->
	<header class="bg-white shadow-sm border-b border-slate-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 class="text-4xl font-bold text-slate-900 mb-2 text-center">
                Needham Community Council Tools
            </h1>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
			{#each tools as tool, index}
				<div 
					class="group relative rounded-xl border-2 p-6 transition-all duration-300 {tool.color} {mounted ? 'animate-fade-in' : ''}"
					style="animation-delay: {index * 150}ms"
				>
					<!-- Icon -->
					<div class="text-6xl mb-4 text-center">
						{tool.icon}
					</div>
					
					<!-- Content -->
					<div class="text-center mb-6">
						<h2 class="text-xl font-semibold text-slate-900 mb-3 group-hover:text-slate-700 transition-colors">
							{tool.title}
						</h2>
						<p class="text-slate-600 text-sm leading-relaxed">
							{tool.description}
						</p>
					</div>
					
					<!-- Action Button -->
					<div class="text-center">
						<a 
							href={tool.href}
							class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white {tool.buttonColor} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-500 transition-all duration-200 transform hover:scale-105 active:scale-95"
						>
							Open Tool
							<svg class="ml-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
							</svg>
						</a>
					</div>
					
					<!-- Decorative corner -->
					<div class="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-white/20 rounded-tr-xl"></div>
				</div>
			{/each}
		</div>
	</main>
</div>

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	
	.animate-fade-in {
		opacity: 0;
        transform: translateY(20px);
		animation: fade-in 0.6s ease-out forwards;
	}
</style>