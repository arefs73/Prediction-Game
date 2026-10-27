import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Both local emulators are required');

test('HTTP verifies identity, preserves missing-profile null, and denies protected mutations', async () => {
  const server = spawn(process.execPath, ['--import','tsx','server/index.ts'], {
    env: { ...process.env, FIREBASE_PROJECT_ID:'demo-prediction-game', FIRESTORE_DATABASE_ID:'(default)', PORT:'3101', ENABLE_ROUND_WORKER:'false' },
    stdio: 'pipe', windowsHide: true,
  });
  const admin = initializeApp({ projectId:'demo-prediction-game' }, 'http-tests');
  const base='http://127.0.0.1:3101/api';
  const uid='http-user-'+Date.now(), email=uid+'@example.com', password='Test-Password-123!';
  const auth=getAuth(admin);
  try {
    for(let i=0;i<100;i++) {
      try { await fetch(base+'/me'); break; } catch { await new Promise(r=>setTimeout(r,100)); }
    }
    assert.equal((await fetch(base+'/me')).status,401);
    assert.equal((await fetch(base+'/me',{headers:{Authorization:'Bearer forged'}})).status,401);
    await auth.createUser({uid,email,password,emailVerified:false});
    const signIn=async()=>{
      const response=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),
      });
      assert.equal(response.status,200); return (await response.json()).idToken as string;
    };
    const unverified=await signIn();
    assert.equal((await fetch(base+'/me',{headers:{Authorization:'Bearer '+unverified}})).status,401);
    await auth.updateUser(uid,{emailVerified:true});
    const token=await signIn(),headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
    const missing=await fetch(base+'/me',{headers}); assert.equal(missing.status,200); assert.equal(await missing.json(),null);
    const created=await fetch(base+'/me',{method:'POST',headers,body:JSON.stringify({username:'HttpTester',firstName:'Http',lastName:'Tester',phone:'+31612345678',tokenBalance:9999,kycStatus:'VERIFIED'})});
    assert.equal(created.status,200); const profile=await created.json();assert.equal(profile.tokenBalance,5);assert.equal(profile.kycStatus,'UNVERIFIED');
    assert.equal((await fetch(base+'/me',{method:'PATCH',headers,body:JSON.stringify({tokenBalance:9999})})).status,403);
    const again=await fetch(base+'/me',{method:'POST',headers,body:JSON.stringify({username:'HttpTester',firstName:'Http',lastName:'Tester',phone:'+31612345678'})});
    assert.equal((await again.json()).tokenBalance,5);
  } finally {
    await auth.deleteUser(uid).catch(()=>{}); await deleteApp(admin);
    server.kill(); await new Promise<void>(resolve=> { if(server.exitCode!==null) resolve();else server.once('exit',()=>resolve()); });
  }
});
