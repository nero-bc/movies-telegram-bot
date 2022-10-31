import { Dexie } from 'dexie'
import { observable, action, makeObservable } from 'mobx'
import { getAuth, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, child, get, set, query, update, remove } from 'firebase/database'
import store from '../utils/storage'

const app = initializeApp({
  apiKey: 'AIzaSyCoQdUA6jN3cWx_yopHDVsC2aIW9Bor2P4',
  authDomain: 'movies-player.firebaseapp.com',
  projectId: 'movies-player',
  databaseURL: 'https://movies-player.firebaseio.com/'
})

const auth = getAuth()
const provider = new GoogleAuthProvider()

const LAST_TIME_SAVE_INTERVAL = 30 * 1000

class RemoteHistoryStorage {
  remoteDb = null
  inited = false

  // eslint-disable-next-line require-await
  _getRemoteDB = async () => {
    if (this.inited) return this.remoteDb

    return new Promise((resolve, reject) => {
      onAuthStateChanged(auth, (user) => {
        if (this.inited) {
          resolve(this.remoteDb)
          return
        }

        if (user) {
          this.remoteDb = ref(getDatabase(app), `library/${user.uid}/history`)
        } else {
          this.remoteDb = null
        }

        this.inited = true

        resolve(this.remoteDb)
      }, reject)
    })
  }

  disconnect = () => {
    this.remoteDb = null
  }

  reset = () => {
    this.remoteDb = null
    this.inited = false
  }

  get = async (key) => {
    const remoteDb = await this._getRemoteDB()

    if (!remoteDb) return

    const snap = await get(child(remoteDb, this._toRemoteKey(key)))
    return snap.val()
  }

  set = async (key, data) => {
    if (!Object.keys(data).length) return

    const remoteDb = await this._getRemoteDB()

    if (!remoteDb) return

    await set(child(remoteDb, this._toRemoteKey(key)), {
      key,
      ...data
    })
  }

  update = async (key, data) => {
    if (!Object.keys(data).length) return

    const remoteDb = await this._getRemoteDB()

    if (!remoteDb) return

    await update(child(remoteDb, this._toRemoteKey(key)), data)
  }

  delete = async (key) => {
    const remoteDb = await this._getRemoteDB()

    if (!remoteDb) return

    await remove(child(remoteDb, this._toRemoteKey(key)))
  }

  all = async () => {
    const remoteDb = await this._getRemoteDB()

    if (!remoteDb) return []

    const snap = await get(query(remoteDb))
    const out = []
    snap.forEach((d) => {
      out.push(d.val())
    })
    return out
  }

  _toRemoteKey(key) {
    return key.replace(/[#.]/g, '_')
  }
}

class LocalHistoryStorage { // eslint-disable-line no-unused-vars
  localDB = new Dexie('HistoryDatabase')

  constructor() {
    this.localDB
      .version(3)
      .stores({
        history: '&key,provider,id,title,image,time,fileIndex,startTime,audio'
      })
  }

  get = async (key) => await this.localDB.history.get(key)

  set = async (key, data) => {
    await this.localDB.history.put({
      key,
      ...data
    })
  }

  update = async (key, data) => {
    await this.localDB.history.update(key, data)
  }

  delete = async (key) => {
    await this.localDB.history
      .where({ key })
      .delete()
  }

  all = async () => await this.localDB.history.toArray()
}

class LocalStoreHistoryStorage {
  get = (key) => store.get(this._toInternalKey(key))

  set = (key, data) => {
    store.set(this._toInternalKey(key), { key, ...data })
  }

  update = (key, data) => {
    store.set(this._toInternalKey(key), { key, ...store.get(key), ...data })
  }

  delete = (key) => {
    store.remove(this._toInternalKey(key))
  }

  all = () => {
    const results = []

    store.each((val, key) => {
      if (key.startsWith('history:')) {
        results.push(val)
      }
    })

    return results
  }

  _toInternalKey = (key) => `history:${key}`

}

class ComposedHistoryStorage {
  initialLoad = false
  updatedKeys = new Set()

  constructor(localHistory, remoteHistory) {
    this.loadHistory = localHistory
    this.remoteHistory = remoteHistory
  }

  get = async (key) => {
    if (!this.updatedKeys.has(key)) {
      const item = await this.remoteHistory.get(key)
      if (item != null) {
        this.updatedKeys.add(key)
        return this._updateLocalItem(item)
      }
    }

    return await this.loadHistory.get(key)
  }

  set = async (key, data) => {
    await Promise.all([
      this.loadHistory.set(key, data),
      this.remoteHistory.set(key, data)
    ])
  }

  update = async (key, data) => {
    await Promise.all([
      this.loadHistory.update(key, data),
      this.remoteHistory.update(key, data)
    ])
  }

  delete = async (key) => {
    await Promise.all([
      this.loadHistory.delete(key),
      this.remoteHistory.delete(key)
    ])
    this.updatedKeys.delete(key)
  }

  all = async () => {
    if (!this.initialLoad) {
      const items = await this.remoteHistory.all()

      await Promise.all(items.map(this._updateLocalItem))

      items.forEach(({ key }) => this.updatedKeys.add(key))
      this.initialLoad = true
    }

    return this.loadHistory.all()
  }

  _updateLocalItem = async (item) => {
    const localItem = await this.loadHistory.get(item.key)
    if (localItem == null || localItem.time < item.time) {
      await this.loadHistory.set(item.key, { ...localItem, ...item })
      return item
    }
    return localItem
  }

  reset = () => {
    this.initialLoad = false
    this.updatedKeys = new Set()
    this.remoteHistory.reset()
  }
}

class WatchHistoryStore {
  @observable insync = false
  @observable history = null

  _remoteHistory = new RemoteHistoryStorage()

  _composedHistory = new ComposedHistoryStorage(
    'indexedDB' in window ? new LocalHistoryStorage() : new LocalStoreHistoryStorage(),
    this._remoteHistory
  )

  constructor() {
    makeObservable(this)

    onAuthStateChanged(auth, (user) => {
      this._setInsync(user != null)
    })
  }

  @action.bound _setInsync = (insync) => {
    this.insync = insync
  }

  loadHistory = async () => {
    const items = await this._composedHistory.all()
    this._setHistory(items.sort((a, b) => b.time - a.time))
  }

  @action.bound _setHistory(history) {
    this.history = history
  }

  @action.bound connect() {
    signInWithPopup(auth, provider)
      .then(this._composedHistory.reset)
      .then(this.loadHistory)
      .catch((error) => {
        console.error('Fail login', error)
      })
  }

  @action.bound disconnect() {
    signOut(auth)
    this._remoteHistory.disconnect()
  }

  watching = async ({ provider, id, title, image }) => {
    const key = this._getItemKey(provider, id)
    const item = await this._composedHistory.get(key)
    await this._composedHistory.set(key, {
      ...item,
      key,
      provider,
      id,
      title,
      image,
      time: Date.now()
    })
  }

  deleteFromHistory = async ({ provider, id }) =>
    await this._composedHistory.delete(this._getItemKey(provider, id))

  updateLastFile = async ({ provider, id }, fileIndex) =>
    await this._composedHistory.update(this._getItemKey(provider, id), { fileIndex, lastTime: 0, time: Date.now() })

  updateStartTime = async ({ provider, id }, startTime) =>
    await this._composedHistory.update(this._getItemKey(provider, id), { startTime })

  _lastTimeSavedTS = 0
  updateLastFilePosition =
    async ({ provider, id }, lastTime) => {
      if (Date.now() - this._lastTimeSavedTS < LAST_TIME_SAVE_INTERVAL) return
      this._lastTimeSavedTS = Date.now()
      await this._composedHistory.update(this._getItemKey(provider, id), { lastTime })
    }


  getHistoryItem = async ({ provider, id }) => {
    const key = this._getItemKey(provider, id)
    return await this._composedHistory.get(key)
  }

  lastEpisode = async ({ provider, id }) => {
    const key = this._getItemKey(provider, id)
    const item = await this._composedHistory.get(key)
    const fileIndex = item?.fileIndex ?? 0
    let startTime = item?.lastTime ?? 0
    if (startTime == 0) startTime = item?.startTime ?? 0

    return {
      fileIndex,
      startTime
    }
  }

  updateAudioTrack = async ({ provider, id }, audio) =>
    await this._composedHistory.update(this._getItemKey(provider, id), { audio, time: Date.now() })

  audioTrack = async ({ provider, id }) => {
    const key = this._getItemKey(provider, id)
    const item = await this._composedHistory.get(key)
    return item?.audio
  }

  _getItemKey(provider, id) {
    return `${provider}#${id}`
  }
}

export default WatchHistoryStore
