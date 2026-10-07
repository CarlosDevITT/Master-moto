const esbuild = require('esbuild');
esbuild.buildSync({entryPoints:['@supabase/supabase-js'],bundle:true,platform:'browser',format:'iife',globalName:'SupabaseSDK',outfile:'js/vendor/supabase.js',minify:true,legalComments:'eof',target:['es2022']});
console.log('SDK Supabase preparado para a hospedagem estática.');
