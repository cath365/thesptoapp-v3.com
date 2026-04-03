const jwt=require('jsonwebtoken'),https=require('https'),fs=require('fs'),path=require('path');
const pk=fs.readFileSync(path.join(__dirname,'AuthKey_X79F2H3QXT.p8'),'utf8');
const now=Math.floor(Date.now()/1000);
const token=jwt.sign({iss:'3ddd637a-4279-41fa-8c12-672a3c557cba',iat:now,exp:now+1200,aud:'appstoreconnect-v1'},pk,{algorithm:'ES256',header:{alg:'ES256',kid:'X79F2H3QXT',typ:'JWT'}});
const opts={hostname:'api.appstoreconnect.apple.com',path:'/v1/apps/6755155637/builds?limit=10',method:'GET',headers:{'Authorization':'Bearer '+token}};
https.request(opts,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{
const j=JSON.parse(d);
const lines=[];
if(j.data){j.data.forEach(b=>lines.push('Build #'+b.attributes.version+' | State: '+b.attributes.processingState+' | Uploaded: '+b.attributes.uploadedDate+' | ID: '+b.id))}
else{lines.push(JSON.stringify(j,null,2))}
fs.writeFileSync(path.join(__dirname,'builds-list.txt'),lines.join('\n'));
console.log(lines.join('\n'));
})}).end();
