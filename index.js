"use strict";var H=Object.defineProperty;var Q=Object.getOwnPropertyDescriptor;var V=Object.getOwnPropertyNames;var X=Object.prototype.hasOwnProperty;var _=(f,i)=>{for(var s in i)H(f,s,{get:i[s],enumerable:!0})},B=(f,i,s,r)=>{if(i&&typeof i=="object"||typeof i=="functio\
n")for(let n of V(i))!X.call(f,n)&&n!==s&&H(f,n,{get:()=>i[n],enumerable:!(r=Q(i,n))||r.enumerable});return f};var ee=f=>B(H({},"__esModule",{value:!0}),f);var ne={};_(ne,{createZip:()=>fe});module.exports=ee(ne);var L,te=()=>{let f=new Int32Array(256),i=new Int32Array(4096),s=-306674912,r,n,l;for(n=0;n<256;n++)r=n,r=r&1?s^r>>>1:r>>>
1,r=r&1?s^r>>>1:r>>>1,r=r&1?s^r>>>1:r>>>1,r=r&1?s^r>>>1:r>>>1,r=r&1?s^r>>>1:r>>>1,r=r&1?s^r>>>1:r>>>1,r=r&1?s^r>>>1:r>>>
1,i[n]=f[n]=r&1?s^r>>>1:r>>>1;for(n=0;n<256;n++)for(l=f[n],r=256+n;r<4096;r+=256)l=i[r]=l>>>8^f[l&255];for(L=[f],n=1;n<16;n++)
L[n]=i.subarray(n*256,n*256+256)},F=(f,i=0)=>{L||te();let[s,r,n,l,S,M,A,O,y,U,v,t,N,e,g,o]=L,c=i^-1,x=f.length-15,a=0;for(;a<
x;)c=o[f[a++]^c&255]^g[f[a++]^c>>8&255]^e[f[a++]^c>>16&255]^N[f[a++]^c>>>24]^t[f[a++]]^v[f[a++]]^U[f[a++]]^y[f[a++]]^O[f[a++]]^
A[f[a++]]^M[f[a++]]^S[f[a++]]^l[f[a++]]^n[f[a++]]^r[f[a++]]^s[f[a++]];for(x+=15;a<x;)c=c>>>8^s[(c^f[a++])&255];return~c};var re=typeof CompressionStream<"u",R=new TextEncoder,W=f=>f.reduce((i,s)=>i+s,0),I=10;async function fe(f,i=!0){let s=[],
r=re&&i,n=f.length,l=f.map(o=>R.encode(o.name)),S=f.map(({data:o})=>typeof o=="string"?R.encode(o):o instanceof ArrayBuffer?
new Uint8Array(o):o),M=W(S.map(o=>o.byteLength)),A=W(l.map(o=>o.byteLength)),O=n*30+A,y=n*46+A,U=22,v=O+y+U+Math.ceil(M*
1.01)+n*128,t=new Uint8Array(v),N=new Date,e=0;for(let o=0;o<n;o++){s[o]=e;let c=l[o],x=c.byteLength,a=S[o],d=a.byteLength,
u=f[o].lastModified??N,Y=u.getSeconds(),q=u.getMinutes(),G=u.getHours(),J=u.getDate(),K=u.getMonth()+1,P=u.getFullYear(),
k=Math.floor(Y/2)+(q<<5)+(G<<11),C=J+(K<<5)+(P-1980<<9);t[e++]=80,t[e++]=75,t[e++]=3,t[e++]=4,t[e++]=20,t[e++]=0,t[e++]=
0,t[e++]=8,t[e++]=r?8:0,t[e++]=0,t[e++]=k&255,t[e++]=k>>8,t[e++]=C&255,t[e++]=C>>8;let D=e;e+=4;let E=e;e+=4,t[e++]=d&255,
t[e++]=d>>8&255,t[e++]=d>>16&255,t[e++]=d>>24,t[e++]=x&255,t[e++]=x>>8&255,t[e++]=0,t[e++]=0,t.set(c,e),e+=x;let h;if(r){
let w=e,Z=new CompressionStream("gzip"),$=Z.writable.getWriter(),j=Z.readable.getReader();$.write(a),$.close();let b=0,T=0;
for(;;){let z=await j.read();if(z.done)throw new Error("Unexpected end of gzip data");let p=z.value;if(b=T,T=b+p.length,
b<=2&&T>2){let m=p[2-b];if(m!==8)throw new Error(`Assumptions violated: gzip not deflated (compression value: ${m})`)}if(b<=
3&&T>3){let m=p[3-b];if(m&30)throw new Error(`Assumptions violated: one or more optional gzip flags present (flags: ${m}\
)`)}if(T===I)break;if(T>I){let m=p.subarray(I-b);t.set(m,e),e+=m.byteLength;break}}for(;;){let z=await j.read();if(z.done)
break;let p=z.value;t.set(p,e),e+=p.byteLength}e-=8,t[D++]=t[e++],t[D++]=t[e++],t[D++]=t[e++],t[D++]=t[e++],e-=4,h=e-w}else{
t.set(a,e),e+=d,h=d;let w=F(a);t[e++]=w&255,t[e++]=w>>8&255,t[e++]=w>>16&255,t[e++]=w>>24}t[E++]=h&255,t[E++]=h>>8&255,t[E++]=
h>>16&255,t[E++]=h>>24}let g=e;for(let o=0;o<n;o++){let c=s[o],x=l[o],a=x.byteLength;t[e++]=80,t[e++]=75,t[e++]=1,t[e++]=
2,t[e++]=20,t[e++]=0,t[e++]=20,t[e++]=0,t.set(t.subarray(c+6,c+30),e),e+=24;for(let d=0;d<10;d++)t[e++]=0;t[e++]=c&255,t[e++]=
c>>8&255,t[e++]=c>>16&255,t[e++]=c>>24,t.set(x,e),e+=a}return t[e++]=80,t[e++]=75,t[e++]=5,t[e++]=6,t[e++]=0,t[e++]=0,t[e++]=
0,t[e++]=0,t[e++]=n&255,t[e++]=n>>8&255,t[e++]=n&255,t[e++]=n>>8&255,t[e++]=y&255,t[e++]=y>>8&255,t[e++]=y>>16&255,t[e++]=
y>>24,t[e++]=g&255,t[e++]=g>>8&255,t[e++]=g>>16&255,t[e++]=g>>24,t[e++]=0,t[e++]=0,t.subarray(0,e)}
