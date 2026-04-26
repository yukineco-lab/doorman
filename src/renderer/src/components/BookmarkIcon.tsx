import { useState, useEffect, type JSX } from 'react'
import { IconGlobe } from './Icons'

interface Props {
  filename: string | null
  version?: number | null
}

export function BookmarkIcon({ filename, version }: Props): JSX.Element {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [filename, version])

  if (!filename || failed) {
    return <IconGlobe />
  }
  return (
    <img
      src={window.api.iconUrl(filename, version)}
      alt=""
      onError={() => setFailed(true)}
      draggable={false}
    />
  )
}
