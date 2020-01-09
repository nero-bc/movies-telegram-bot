import { observable, action } from 'mobx'
import localStore from 'store'
import logger from '../utils/logger'

const END_FILE_TIME_OFFSET = 60
const getPlaylistPrefix = (playlist) => `playlist:${playlist.provider}:${playlist.id}`


export class Device {
    @observable playlist = { name: '', files: [] }
    @observable currentFileIndex = 0
    @observable currentTime = 0
    @observable duration = 0
    @observable buffered = 0
    @observable isPlaying = false
    @observable isLoading = false
    @observable error = null
    @observable volume = 1
    @observable isMuted = false
    @observable audioTracks = []
    @observable audioTrack = null
    @observable shuffle = false
    @observable seekTime = null
    @observable quality = null
    @observable qualities = []
    
    isLocal() {
        return true
    }

    /* eslint-disable no-unused-vars */
    resume() { }
    pause() { }
    play(currentTime) { }
    seek(currentTime) { }
    disconnect() { }
    setVolume(volume) { }
    selectFile(fileIndex) { }
    setPlaylist(playlist, fileIndex, marks) { }
    setAudioTrack(id) { }
    setAudioTracks(audioTracks) { }
    /* eslint-enable */

    @action.bound seeking(seekTime) {
        this.seekTime = seekTime
    }

    @action.bound setQuality(quality) {
        this.quality = quality
        localStore.set('quality', quality)
    }

    @action.bound setShuffle(shuffle) {
        this.shuffle = shuffle
        localStore.set('shuffle', shuffle)
    }
    
    skip(sec) {
        if (this.duration) {
            const seekTo = this.currentTime + sec
            this.seek(Math.min(Math.max(seekTo, 0), this.duration))
        }
    }
}

export class LocalDevice extends Device {
    @observable seekTo = null
    @observable source = null

    constructor() {
        super()
        this.volume = localStore.get('volume') || 1
        this.shuffle = localStore.get('shuffle') || false
    }

    @action.bound play(currentTime) {
        this.isPlaying = true
        if (currentTime !== null && !isNaN(currentTime)) {
            this.currentTime = currentTime
            this.seekTo = currentTime
        }
        this.seekTime = null
    }

    @action.bound setSource(source) {
        this.source = source
        this.currentTime = source.currentTime || 0
        this.duration = 0
        this.buffered = 0
        this.audioTrack = null
        this.audioTracks = []

        if (source.url && source.alternativeUrls && !source.qualityUrls) {
            const urls = [source.url].concat(source.alternativeUrls)

            source.qualityUrls = urls
                .map((link) => {
                    const res = link.match(/(?<url>.*[^\d](?<quality>\d+).mp4)/)
                    return res && {
                        url: res.groups.url,
                        quality: res.groups.quality
                    }
                })
                .filter((it) => it)
                .reduce((acc, { url, quality }) => ({ ...acc, [quality]: url }), {})
        }

        if (source.qualityUrls) {
            this.qualities = Object.keys(source.qualityUrls)
            const storedQuality = localStore.get('quality')
            this.quality = storedQuality && this.qualities.indexOf(storedQuality) != -1 ?
                storedQuality :
                null
        } else {
            this.qualities = []
            this.quality = null
        }
    }

    @action.bound seek(seekTo) {
        this.seekTo = seekTo
        this.seekTime = null
    }

    @action.bound resume() {
        this.isPlaying = true
        this.seekTime = null
    }

    @action.bound pause() {
        this.isPlaying = false
    }

    @action.bound onUpdate({ duration, buffered, currentTime }) {
        if (duration) this.duration = duration
        if (buffered) this.buffered = buffered
        if (currentTime) {
            this.currentTime = currentTime

            if (this.duration) {
                const timeLimit = Math.max(0, this.duration - END_FILE_TIME_OFFSET)
                const mark = Math.min(timeLimit, currentTime)
                localStore.set(`${getPlaylistPrefix(this.playlist)}:ts`, mark)
            }
        }
    }

    @action.bound setPlaylist(playlist, fileIndex, startTime) {
        this.playlist = playlist
        this.selectFile(fileIndex || 0)
        this.play(startTime)
        this.isPlaying = false
    }

    @action.bound selectFile(fileIndex) {
        const { files } = this.playlist

        if (fileIndex < 0 || fileIndex >= files.length)
            return false

        const playlistPrefix = getPlaylistPrefix(this.playlist)

        localStore.set(`${playlistPrefix}:current`, fileIndex)

        this.currentFileIndex = fileIndex

        const file = files[this.currentFileIndex]
        this.setSource(file)

        return true
    }

    @action.bound setLoading(loading) {
        this.isLoading = loading
    }

    @action.bound setError(error) {
        this.error = error

        if (error) {
            logger.error(error, {
                title: document.title,
                url: location.href,
                source: this.source
            })

            window.gtag && gtag('event', 'play', {
                'event_category': 'error',
                'event_label': error
            })
        }
    }

    @action.bound setVolume(volume) {
        this.volume = volume
        localStore.set('volume', volume)
    }

    @action.bound setAudioTrack(id) {
        this.audioTrack = id
        localStore.set(`${getPlaylistPrefix(this.playlist)}:audio_track`, id)
    }

    @action.bound setAudioTracks(audioTracks) {
        this.audioTracks = audioTracks

        const storesAudioTrack = localStore.get(`${getPlaylistPrefix(this.playlist)}:audio_track`)
        if(storesAudioTrack) {
            const audioTrack = audioTracks.find(({ id }) => id == storesAudioTrack)
            if(audioTracks) {
                this.audioTrack = audioTrack.id
            }
        }
    }

    @action.bound toggleMute() {
        this.isMuted = !this.isMuted
    }
}

class PlayerStore {
    @observable device = null

    @action.bound setDevice(device) {
        const prevDevice = this.device
        if (prevDevice) prevDevice.disconnect()

        this.device = device
    }

    @action.bound switchToLocalDevice() {
        this.switchDevice(new LocalDevice())
    }

    @action.bound switchDevice (device) {
        const prevDevice = this.device
        const { playlist, currentFileIndex, currentTime } = prevDevice

        if (prevDevice) prevDevice.disconnect()

        this.device = device
        this.device.setPlaylist(playlist, currentFileIndex, currentTime)
    }

    @action.bound openPlaylist(playlist, fileIndex, startTime) {
        this.device = new LocalDevice()

        if (fileIndex == null || isNaN(fileIndex)) {
            fileIndex = localStore.get(`${getPlaylistPrefix(playlist)}:current`)

            if (startTime == null || isNaN(startTime)) {
                startTime = parseFloat(localStore.get(`${getPlaylistPrefix(playlist)}:ts`))
            }
        }

        this.device.setPlaylist(playlist, fileIndex, startTime)
        document.title = this.getPlayerTitle()
    }

    @action.bound switchFile(fileIndex) {
        if (this.device.selectFile(fileIndex)) {
            this.device.play()
        } else {
            this.device.pause()
        }
        document.title = this.getPlayerTitle()

        window.gtag && gtag('event', 'selectFile', {
            'event_category': 'video',
            'event_label': document.title
        })
    }

    @action.bound prevFile() {
        this.switchFile(this.device.currentFileIndex - 1)
    }

    @action.bound nextFile() {
        this.switchFileOrShuffle(this.device.currentFileIndex + 1)
    }

    @action.bound switchFileOrShuffle(fileIndex) {
        const { currentFileIndex, shuffle, playlist } = this.device
        const { files } = playlist

        if (files.length > 1 && shuffle) {
            let next

            do {
                next = Math.round(Math.random() * (files.length - 1))
            } while (next == currentFileIndex)

            this.switchFile(next)
        } else {
            this.switchFile(fileIndex)
        }
    }

    getPlayerTitle() {
        const {
            playlist: { title, files },
            currentFileIndex
        } = this.device

        if (title && files) {
            let res = title

            if(files.length > 1) {
                const file = files[currentFileIndex]
                let currentPath = file.path
                currentPath = currentPath ? currentPath.split('/') : []
                currentPath = currentPath.concat(file.name)

                res += ' - ' + currentPath.join(' / ')
            }

            return res
        }
    }
}

export default new PlayerStore()