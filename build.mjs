import {createRequire} from 'node:module';
import {existsSync,mkdirSync,cpSync,copyFileSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';

const root=dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/,''));
const local=join(root,'node_modules');
const sibling=resolve(root,'../agri-guard/node_modules');
const search=[local,sibling].filter(existsSync);
const require=createRequire(import.meta.url);
const esbuild=require(require.resolve('esbuild',{paths:search}));
const docs=join(root,'docs');
mkdirSync(docs,{recursive:true});
const packages=['react','react-dom','three','@react-three/fiber','@react-three/drei'];
for(const name of packages){
  if(!search.some(path=>existsSync(join(path,name))))throw new Error(`Missing dependency: ${name}. Run npm install.`);
}
const result=await esbuild.build({
  entryPoints:[join(root,'src/main.jsx')],bundle:true,minify:true,format:'iife',platform:'browser',target:['es2020'],jsx:'automatic',
  outfile:join(docs,'app.js'),nodePaths:search,legalComments:'eof',metafile:true,logLevel:'info',
  loader:{'.ts':'ts','.tsx':'tsx','.jsx':'jsx'},
});
copyFileSync(join(root,'src/style.css'),join(docs,'style.css'));
cpSync(join(root,'public'),docs,{recursive:true});
const licenseDir=join(docs,'licenses');mkdirSync(licenseDir,{recursive:true});
for(const name of packages){
  const packageRoot=search.map(path=>join(path,name)).find(existsSync);
  const license=['LICENSE','LICENSE.md','LICENSE.txt'].map(file=>join(packageRoot,file)).find(existsSync);
  if(license)copyFileSync(license,join(licenseDir,name.replace('/','-')+'.txt'));
}
const bundledPackages=new Map();
const emittedInputs=new Set(Object.values(result.metafile.outputs).flatMap(output=>Object.entries(output.inputs||{}).filter(([,value])=>value.bytesInOutput>0).map(([name])=>name)));
for(const input of emittedInputs){
  let directory=dirname(resolve(root,input));
  if(!directory.includes('node_modules'))continue;
  while(directory.includes('node_modules')){
    const metadata=join(directory,'package.json');
    if(existsSync(metadata)){
      const info=JSON.parse(readFileSync(metadata,'utf8'));
      if(info.name){bundledPackages.set(info.name,{...info,root:directory});break;}
    }
    directory=dirname(directory);
  }
}
const missingLicenses=[];
const notices=[];
for(const info of bundledPackages.values()){
  const licenseFiles=readdirSync(info.root).filter(name=>/^(license|licence|copying|notice)(\..*)?$/i.test(name));
  notices.push(`${info.name}@${info.version} (${info.license||'see license'})`);
  for(const file of licenseFiles){
    const safeName=info.name.replace(/[\/@]/g,'-');
    copyFileSync(join(info.root,file),join(licenseDir,`${safeName}-${file}.txt`));
  }
  if(!licenseFiles.length&&!existsSync(join(licenseDir,info.name.replace(/[\/@]/g,'-')+'.txt')))missingLicenses.push(info.name);
}
writeFileSync(join(licenseDir,'BUNDLED-PACKAGES.txt'),notices.sort().join('\n')+'\n');
if(missingLicenses.length)console.warn('License files requiring review: '+missingLicenses.join(', '));
writeFileSync(join(docs,'index.html'),`<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#174b47"><meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; connect-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'"><meta name="description" content="AgriSAGE 체험용 정적 데모. AI 모의 응답과 가상 농장 시뮬레이터."><title>AgriSAGE · 정적 체험판</title><link rel="stylesheet" href="./style.css"></head><body><div id="root"></div><script src="./app.js" defer></script></body></html>\n`);
writeFileSync(join(docs,'.nojekyll'),'');
console.log(`Built ${docs}`);
