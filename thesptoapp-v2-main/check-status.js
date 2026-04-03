const jwt=require('jsonwebtoken'),https=require('https'),fs=require('fs'),path=require('path');
const pk=fs.readFileSync(path.join(__dirname,'AuthKey_X79F2H3QXT.p8'),'utf8');
const now=Math.floor(Date.now()/1000);
const token=jwt.sign({iss:'3ddd637a-4279-41fa-8c12-672a3c557cba',iat:now,exp:now+1200,aud:'appstoreconnect-v1'},pk,{algorithm:'ES256',header:{alg:'ES256',kid:'X79F2H3QXT',typ:'JWT'}});
const opts={hostname:'api.appstoreconnect.apple.com',path:'/v1/appStoreVersions/193a42ea-6826-4118-a8d2-d6483702e08c?include=build',method:'GET',headers:{'Authorization':'Bearer '+token}};
https.request(opts,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{const j=JSON.parse(d);
const lines = [];
lines.push('Version: ' + j.data.attributes.versionString);
lines.push('State: ' + j.data.attributes.appStoreState);
if(j.included && j.included[0]){
  lines.push('Build ID: ' + j.included[0].id);
  lines.push('Build #: ' + j.included[0].attributes.version);
  lines.push('Processing: ' + j.included[0].attributes.processingState);
}
fs.writeFileSync(path.join(__dirname, 'status-result.txt'), lines.join('\n'));
console.log(lines.join('\n'));
})}).end();
