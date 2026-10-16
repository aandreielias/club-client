import { mount } from 'svelte';
import App from './App.svelte';
import { bootstrap } from './bootstrap';
import '@fontsource-variable/inter';
import './styles.css';

bootstrap();
mount(App, { target: document.getElementById('app')! });
