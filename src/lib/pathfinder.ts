export const pathfinderRevision = "d07b3fcf96c3dd04f9ffc5e59120a61d93e99e5a";
export function portalOrigin(input: string): string | null {
 try {
  const url=new URL(input.trim());
  const local=["localhost","127.0.0.1","[::1]"].includes(url.hostname);
  if((url.protocol!=="https:"&&!(local&&url.protocol==="http:"))||url.username||url.password||url.search||url.hash||url.pathname!=="/")return null;
  return url.origin;
 }catch{return null;}
}
