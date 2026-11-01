import type {NextConfig} from 'next';
const config:NextConfig={images:{localPatterns:['/photos/**','/models/**','/templates/**'].map(pathname=>({pathname,search:''}))},serverExternalPackages:['sharp','@resvg/resvg-js'],experimental:{proxyClientMaxBodySize:'251mb'},outputFileTracingExcludes:{'*':['./.local-data/**/*','./out/**/*','./input/**/*']},webpack(config){config.watchOptions={...config.watchOptions,ignored:/node_modules|\.local-data|\.next|\.git|[\\/]out[\\/]|[\\/]input[\\/]/};return config;}};
export default config;

