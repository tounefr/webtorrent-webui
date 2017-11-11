const types = require('./types')

function getStats (state) {
  const stats = types.getSessionStats()

  stats['cumulative-stats'].downloadedBytes = Object.values(state.dl).reduce((el, prev) => el + prev)
  stats['cumulative-stats'].uploadedBytes = Object.values(state.up).reduce((el, prev) => el + prev)

  return stats
}

function wtToTransmissionTorrentDetail (wt, state) {
  const t = types.getTorrentDetail()

  t.hashString = wt.infoHash
  t.id = wt.infoHash

  // If no metadata available
  if (!wt.name || !wt.files) {
    return t
  }

  t.id = wt.infoHash
  t.comment = wt.comment
  t.percentDone = wt.progress
  t.haveValid = wt.downloaded
  t.pieceSize = wt.pieceLength
  t.pieceCount = wt.pieces ? wt.pieces.length : -1
  t.downloadedEver = wt.info ? wt.downloaded : -1

  const unwantedFiles = state.unwanted[wt.infoHash] || []
  const files = wt.files ? wt.files.sort((a, b) => (a.path > b.path ? 1 : -1)) : []

  files.forEach((file, i) => {
    t.files.push({
      bytesCompleted: Math.min(file.length, file.downloaded), // download can be higher than the actual length
      length: file.length,
      name: file.name
    })

    t.fileStats.push({
      bytesCompleted: file.downloaded,
      priority: 0,
      wanted: (file.progress >= 1) ? true : !unwantedFiles.includes(i)
    })
  })

  const trackers = wt.announce || []
  t.trackerStats = trackers.map(trackerName => {
    const tracker = types.getTrackerDetail()
    tracker.announce = trackerName
    tracker.host = trackerName
    return tracker
  })

  const wires = wt.wires || []
  t.peers = []
  wires.forEach(wire => {
    if (!wire.remoteAddress) return

    const peer = types.getPeer()
    peer.rateToClient = wire.downloadSpeed()
    peer.rateToPeer = wire.uploadSpeed()
    peer.address = wire.remoteAddress
    peer.progress = wire.isSeeder ? 1 : 0.5
    t.peers.push(peer)
  })

  t.peers = t.peers.sort((a, b) => (a.rateToClient < b.rateToClient ? 1 : -1))

  return t
}

function wtToTransmissionTorrent (wt, state, isAdded) {
  const t = types.getTorrent()

  t.recheckProgress = !isAdded ? wt.progress : 1
  t.id = wt.infoHash
  t.peersConnected = wt.numPeers
  t.peersGettingFromUs = wt.numPeers
  t.peersSendingToUs = wt.numPeers
  t.name = wt.name || wt.infoHash

  // If no metadata available
  if (!wt.name || !wt.files || !wt.files.length) {
    t.status = 4
    t.percentDone = 0
    t.metadataPercentComplete = 0
    return t
  }

  // We have metadata
  t.metadataPercentComplete = 1
  t.status = state.paused[wt.infoHash] ? 0 : (!isAdded ? 2 : (wt.progress === 1 ? 6 : 4)) // 6 seeding, 4 dl, 0 paused, 2 verif-local-data
  t.isFinished = wt.progress === 1
  t.eta = wt.timeRemaining ? Math.floor(wt.timeRemaining / 1000) : 9999999999999
  t.downloadDir = wt.path
  t.percentDone = wt.progress
  t.rateDownload = state.paused[wt.infoHash] ? 0 : wt.downloadSpeed
  t.rateUpload = state.paused[wt.infoHash] ? 0 : wt.uploadSpeed

  t.uploadedEver = state.up[wt.infoHash] || wt.uploaded
  t.uploadRatio = t.uploadedEver / (wt.downloaded || 1)

  const total = Math.floor(wt.downloaded / wt.progress)
  t.totalSize = total
  t.sizeWhenDone = total
  t.leftUntilDone = Math.floor(total - wt.downloaded)

  return t
}

module.exports = {
  getStats,
  wtToTransmissionTorrent,
  wtToTransmissionTorrentDetail
}