import { InkPlate } from './InkPlate.tsx'

const ink = '#cbb89a'
const rust = '#8d5a3c'
const steel = '#9aa3a0'

export function AssetGlyph({ id }: { id: string }) {
  return (
    <InkPlate>
      {draw(id)}
    </InkPlate>
  )
}

function draw(id: string) {
  if (id === 'garage' || id === 'chop-shop') {
    return (
      <g stroke={ink} strokeWidth="1.6">
        <path d="M28 96 V52 H192 V96" />
        <path d="M40 52 V34 H180 V52" />
        <path d="M48 78 H172" stroke={rust} />
        <path d="M36 96 H70 V70 H150 V96" />
        <path d="M78 70 V96 M96 70 V96 M114 70 V96 M132 70 V96" stroke={steel} />
        <path d="M158 62 h22 v10 h-22" />
      </g>
    )
  }
  if (id === 'safehouse') {
    return (
      <g stroke={ink} strokeWidth="1.6">
        <path d="M40 100 V48 L110 22 L180 48 V100" />
        <path d="M96 100 V68 H124 V100" />
        <path d="M58 62 H82 V78 H58 Z" />
        <path d="M138 58 H166 V74 H138 Z" />
        <path d="M46 100 H174" stroke={rust} />
      </g>
    )
  }
  if (id === 'hangar') {
    return (
      <g stroke={ink} strokeWidth="1.6">
        <path d="M18 100 H202" stroke={rust} />
        <path d="M30 100 V58 Q110 28 190 58 V100" />
        <path d="M48 100 V72 H172 V100" />
        <path d="M70 86 H150" stroke={steel} />
      </g>
    )
  }
  if (id === 'caravan') {
    return (
      <g stroke={ink} strokeWidth="1.6">
        <path d="M28 78 H150 V46 H70 L52 64 H28 Z" />
        <path d="M86 52 V74 M110 52 V74" stroke={steel} />
        <circle cx="58" cy="86" r="10" />
        <circle cx="128" cy="86" r="10" />
        <path d="M150 64 H186 V78 H150" />
      </g>
    )
  }
  if (id === 'warehouse') {
    return (
      <g stroke={ink} strokeWidth="1.6">
        <path d="M24 100 V44 H196 V100" />
        <path d="M24 44 L110 22 L196 44" />
        <path d="M48 100 V62 H96 V100" />
        <path d="M124 100 V62 H172 V100" />
        <path d="M24 58 H196" stroke={rust} />
      </g>
    )
  }
  if (id === 'front') {
    return (
      <g stroke={ink} strokeWidth="1.6">
        <path d="M36 100 V40 H184 V100" />
        <path d="M36 56 H184" />
        <path d="M52 56 V100 M168 56 V100" stroke={steel} />
        <path d="M90 100 V70 H130 V100" />
        <path d="M70 28 H150" stroke={rust} />
      </g>
    )
  }
  if (id === 'dock') {
    return (
      <g stroke={ink} strokeWidth="1.6">
        <path d="M16 88 H204" stroke={rust} />
        <path d="M40 88 V48 H70 V88 M150 88 V40 H180 V88" />
        <path d="M70 64 H150" />
        <path d="M90 64 V88 M110 64 V88 M130 64 V88" stroke={steel} />
      </g>
    )
  }
  if (id === 'helipad') {
    return (
      <g stroke={ink} strokeWidth="1.6">
        <path d="M30 96 L70 48 H150 L190 96" />
        <circle cx="110" cy="78" r="22" />
        <path d="M110 64 V92 M98 78 H122" stroke={rust} />
      </g>
    )
  }
  if (id === 'casino') {
    return (
      <g stroke={ink} strokeWidth="1.6">
        <path d="M34 100 V46 H186 V100" />
        <path d="M34 62 H186" />
        <path d="M70 46 V28 H150 V46" />
        <circle cx="88" cy="80" r="10" stroke={rust} />
        <path d="M124 70 H156 V90 H124 Z" stroke={steel} />
      </g>
    )
  }
  if (id === 'estate') {
    return (
      <g stroke={ink} strokeWidth="1.6">
        <path d="M16 100 H204" stroke={rust} />
        <path d="M48 100 V58 H172 V100" />
        <path d="M48 58 L110 30 L172 58" />
        <path d="M96 100 V74 H124 V100" />
        <path d="M28 78 H48 M172 78 H196" stroke={steel} />
      </g>
    )
  }
  if (id === 'car' || id === 'limousine') {
    return (
      <g stroke={ink} strokeWidth="1.7">
        <path d="M28 84 H192" stroke={rust} />
        <path d="M36 84 L52 64 H120 L148 48 H188 V84" />
        <path d="M70 64 V84 M128 56 V84" stroke={steel} />
        <circle cx="68" cy="88" r="10" />
        <circle cx="164" cy="88" r="10" />
      </g>
    )
  }
  if (id === 'bike') {
    return (
      <g stroke={ink} strokeWidth="1.7">
        <circle cx="58" cy="92" r="18" />
        <circle cx="162" cy="92" r="18" />
        <path d="M58 92 L96 58 H132 L162 92" />
        <path d="M96 58 L118 92" stroke={rust} />
        <path d="M118 48 V58" stroke={steel} />
      </g>
    )
  }
  if (id === 'truck' || id === 'armored-van') {
    return (
      <g stroke={ink} strokeWidth="1.7">
        <path d="M22 90 V52 H120 V90" />
        <path d="M120 64 H168 L190 82 V90 H120" />
        <path d="M36 64 H104" stroke={steel} />
        <circle cx="52" cy="96" r="10" />
        <circle cx="156" cy="96" r="10" />
        <path d="M22 90 H200" stroke={rust} />
      </g>
    )
  }
  if (id === 'airplane') {
    return (
      <g stroke={ink} strokeWidth="1.7">
        <path d="M28 78 L168 52 L196 64 L150 78 L188 92 L150 86 L40 98 Z" />
        <path d="M90 68 L70 40 M100 80 L78 108" stroke={rust} />
      </g>
    )
  }
  if (id === 'speedboat' || id === 'yacht') {
    return (
      <g stroke={ink} strokeWidth="1.7">
        <path d="M24 88 H150 L190 100 H40 Z" />
        <path d="M70 88 V58 H92 L130 88" />
        <path d="M24 108 Q80 96 190 112" stroke={steel} />
        <path d="M150 70 V88" stroke={rust} />
      </g>
    )
  }
  if (id === 'helicopter') {
    return (
      <g stroke={ink} strokeWidth="1.7">
        <path d="M30 48 H190" stroke={rust} />
        <path d="M70 58 H150 L168 78 H86 L70 58" />
        <path d="M110 48 V58 M96 92 V108 H150" stroke={steel} />
        <path d="M168 70 L196 86" />
      </g>
    )
  }
  if (id === 'predictor' || id === 'estimate-predictor') {
    return (
      <g stroke={ink} strokeWidth="1.7">
        <path d="M58 36 H150 L168 54 V108 H58 Z" />
        <path d="M150 36 V54 H168" stroke={rust} />
        <path d="M74 70 H140 M74 84 H120" stroke={steel} />
        <path d="M74 98 H96" stroke={rust} />
      </g>
    )
  }
  if (id === 'security-camera' || id === 'camera') {
    return (
      <g stroke={ink} strokeWidth="1.7">
        <path d="M36 40 H70 V96" />
        <path d="M70 58 H130 L160 46 V86 L130 74 H70" />
        <circle cx="118" cy="66" r="8" stroke={rust} />
        <path d="M40 96 H64" stroke={steel} />
      </g>
    )
  }
  return (
    <g stroke={ink} strokeWidth="1.7">
      <rect x="70" y="48" width="80" height="52" />
      <path d="M86 48 V36 H134 V48" stroke={rust} />
      <path d="M100 100 V72 H120 V100" stroke={steel} />
    </g>
  )
}
