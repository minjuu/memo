// 로그인하면 노트를 Firestore(users/{uid}, users/{uid}/pages/{pageId})와 동기화한다.
import { firebaseConfig } from './firebase-config.js?v=2';

const app = window.memoApp;

if (!firebaseConfig.apiKey) {
  window.cloud = { enabled: false };
} else {
  const V = 'https://www.gstatic.com/firebasejs/10.14.1';
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import(`${V}/firebase-app.js`), import(`${V}/firebase-auth.js`), import(`${V}/firebase-firestore.js`),
  ]);
  const fb = initializeApp(firebaseConfig);
  const a = auth.getAuth(fb), store = fs.getFirestore(fb), provider = new auth.GoogleAuthProvider();
  let user = null, synced = new Map(), syncedRoot = null, timer = null, busy = false, again = false;

  const userDoc = () => fs.doc(store, 'users', user.uid);
  const pageDoc = id => fs.doc(store, 'users', user.uid, 'pages', id);

  function remember(snapshot) {
    synced = new Map(Object.entries(snapshot.pages));
    syncedRoot = snapshot.root;
  }

  async function pull() {
    const meta = await fs.getDoc(userDoc());
    if (!meta.exists()) return null;
    const snap = await fs.getDocs(fs.collection(store, 'users', user.uid, 'pages'));
    const pages = {};
    snap.forEach(d => { pages[d.id] = d.data(); });
    return { root: meta.data().root || [], pages };
  }

  // 바뀐 페이지만 골라 한 번에 쓴다
  async function flush() {
    timer = null;
    if (!user) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      const db = app.data();
      const now = { pages: {}, root: JSON.stringify(db.root) };
      const ops = [];
      for (const p of Object.values(db.pages)) {
        now.pages[p.id] = JSON.stringify(p);
        if (synced.get(p.id) !== now.pages[p.id]) ops.push(b => b.set(pageDoc(p.id), JSON.parse(now.pages[p.id])));
      }
      for (const id of synced.keys()) if (!db.pages[id]) ops.push(b => b.delete(pageDoc(id)));
      if (now.root !== syncedRoot) ops.push(b => b.set(userDoc(), { root: db.root, updated: Date.now() }));
      for (let i = 0; i < ops.length; i += 450) {
        const batch = fs.writeBatch(store);
        ops.slice(i, i + 450).forEach(op => op(batch));
        await batch.commit();
      }
      remember(now);
      if (ops.length) app.status('동기화됨');
    } catch (e) {
      console.error(e);
      app.status('동기화하지 못했어요');
    } finally {
      busy = false;
      if (again) { again = false; flush(); }
    }
  }

  const asSnapshot = d => ({ root: JSON.stringify(d.root), pages: Object.fromEntries(Object.values(d.pages).map(p => [p.id, JSON.stringify(p)])) });

  async function load() {
    const remote = await pull();
    if (remote && Object.keys(remote.pages).length) {
      app.replace(remote);
      remember(asSnapshot(app.data()));
    } else {
      // 처음 로그인하면 지금 이 기기의 노트를 올린다
      synced = new Map();
      syncedRoot = null;
      await flush();
      for (const id of app.fileIds()) {
        const data = await app.fileData(id);
        if (data) await window.cloud.putFile(id, data);
      }
    }
  }

  window.cloud = {
    enabled: true,
    get user() { return user; },
    async login() {
      try {
        await auth.signInWithPopup(a, provider);
      } catch (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return auth.signInWithRedirect(a, provider);
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') throw e;
      }
    },
    async logout() {
      clearTimeout(timer);
      await flush();
      await auth.signOut(a);
    },
    // 이미지·파일은 users/{uid}/files/{id} 문서 하나에 하나씩 둔다
    async putFile(id, data) {
      if (!user) return;
      try {
        await fs.setDoc(fs.doc(store, 'users', user.uid, 'files', id), { data });
      } catch (e) {
        console.error(e);
        app.status('파일을 올리지 못했어요');
      }
    },
    async getFile(id) {
      if (!user) return null;
      const d = await fs.getDoc(fs.doc(store, 'users', user.uid, 'files', id));
      return d.exists() ? d.data().data : null;
    },
    schedule() {
      if (!user) return;
      clearTimeout(timer);
      timer = setTimeout(flush, 800);
    },
  };

  auth.onAuthStateChanged(a, async u => {
    user = u;
    synced = new Map();
    syncedRoot = null;
    if (!u) return app.signedOut();
    app.claim(u.uid);
    app.status('불러오는 중');
    try {
      await load();
      app.status('동기화됨');
    } catch (e) {
      console.error(e);
      app.status('불러오지 못했어요');
    }
    app.signedIn(u);
  });

  // 다른 기기에서 고친 내용을 탭으로 돌아올 때 가져온다
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !user || timer || busy) return;
    try {
      const remote = await pull();
      if (!remote) return;
      const snap = asSnapshot(remote);
      const changed = snap.root !== syncedRoot || synced.size !== Object.keys(snap.pages).length ||
        Object.entries(snap.pages).some(([id, j]) => synced.get(id) !== j);
      if (changed && !document.activeElement?.isContentEditable) {
        app.replace(remote);
        remember(asSnapshot(app.data()));
      }
    } catch (e) {
      console.error(e);
    }
  });
  app.signedIn(null);
}
