import {defineConfig} from 'vite';
export default defineConfig({base:'/studio/',worker:{format:'es'},build:{chunkSizeWarningLimit:3500}});
