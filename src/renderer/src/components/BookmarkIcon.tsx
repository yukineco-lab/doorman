import { useState, useEffect, type JSX } from 'react'
import { IconGlobe } from './Icons'

interface Props {
  filename: string | null
}

export function BookmarkIcon({ filename }: Props): JSX.Element {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [filename])

  if (!filename || failed) {
    return <IconGlobe />
  }
  return (
    <img
      src={window.api.iconUrl(filename)}
      alt=""
      onError={() => setFailed(true)}
      draggable={false}
    />
  )
}
