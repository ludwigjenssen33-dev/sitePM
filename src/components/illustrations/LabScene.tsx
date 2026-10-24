import { useId } from "react";

type Props = {
  variant?: "hero" | "guide" | "celebrate" | "investigate";
  className?: string;
};
const ink = "var(--figure-ink, #202027)";

/** Original monochrome stick figures: no faces, clothing or individual appearance. */
export default function LabScene({ variant = "hero", className = "" }: Props) {
  const uid = useId();
  const compact = variant === "guide";
  const title = compact
    ? "Стикмен-наставник с ноутбуком"
    : variant === "celebrate"
      ? "Стикмены празднуют завершение миссии"
      : variant === "investigate"
        ? "Стикмены исследуют график с лупой"
        : "Стикмены Product Lab: один изучает график, другой работает с ноутбуком";
  return (
    <svg
      className={`lab-scene lab-scene-${variant} ${className}`}
      viewBox={compact ? "0 0 240 240" : "0 0 640 500"}
      role="img"
      aria-labelledby={uid}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id={uid}>{title}</title>

      {compact ? (
        <Guide />
      ) : (
        <>
          <path
            d="M66 411C-2 305 48 147 174 80c124-67 327-28 385 87 70 139 16 265-110 282C306 468 139 475 66 411Z"
            fill="var(--scene-backdrop, #ede9ff)"
          />
          <circle cx="536" cy="88" r="42" fill="#d2f66c" />
          <path
            d="m521 88 10 10 21-25"
            stroke={ink}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ChartBoard />
          <ellipse cx="314" cy="456" rx="239" ry="10" fill="var(--scene-shadow, #d8d1f5)" />
          <g
            className="scene-person-one"
            fill="none"
            stroke={ink}
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="135" cy="201" r="23" fill={ink} stroke="none" />
            <path d="M135 236v98m0-74-35 34 25 25m10 15-29 63-2 47m31-110 37 64 23 46M93 446h25m72 0h23" />
            <path
              d={
                variant === "celebrate"
                  ? "m135 262 38-35 18-39"
                  : "m135 259 52 12 44-55"
              }
            />
          </g>
          <g
            className="scene-person-two"
            fill="none"
            stroke={ink}
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="445" cy="299" r="23" fill={ink} stroke="none" />
            <path d="m445 334-15 58-38 19-2 36m40-55 43 16 20 39M377 450h23m88 0h24" />
            {variant === "celebrate" ? (
              <path d="m442 345-30-22-17-37m47 59 37-25 10-37" />
            ) : (
              <path d="m442 345-31 26 37 11m-6-37 34 24 28-14" />
            )}
          </g>
          {variant !== "celebrate" && <Laptop x={414} y={361} />}
          {variant === "investigate" && (
            <g fill="none" stroke={ink} strokeLinecap="round">
              <circle
                cx="229"
                cy="208"
                r="26"
                fill="#ffffffc9"
                strokeWidth="5"
              />
              <path d="m211 228-19 24" strokeWidth="8" />
            </g>
          )}
          <g className="scene-note" transform="rotate(-8 40 365)">
            <rect
              x="40"
              y="365"
              width="129"
              height="60"
              rx="12"
              fill="var(--scene-paper, white)"
              stroke={ink}
              strokeWidth="2"
            />
            <text x="55" y="389" fontFamily="inherit" fontSize="12" fill={ink}>
              Гипотеза ≠ факт
            </text>
            <path
              d="m57 404 13 4 28-9"
              stroke="#4933ed"
              strokeWidth="3"
              fill="none"
            />
          </g>
          {variant === "celebrate" && (
            <g fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round">
              <path d="m80 96 8 14m95-49 9 11m366-19-8 15m35 295 12-9" />
              <circle cx="298" cy="50" r="6" />
              <path d="m566 162 8 8m-8 0 8-8" />
            </g>
          )}
        </>
      )}
      <g className="winter-decoration" aria-hidden="true" fill="#b5313e" stroke="var(--scene-paper, white)" strokeWidth="2">{(compact?[[98,36]]:[[135,180],[445,278]]).map(([x,y])=><g key={x}><path d={`M${x-22} ${y}l15-25 23 25Z`}/><rect x={x-25} y={y-1} width="50" height="8" rx="4"/><circle cx={x-7} cy={y-25} r="5" fill="white"/></g>)}</g>
    </svg>
  );
}

function Guide() {
  return (
    <>
      <circle cx="120" cy="120" r="109" fill="var(--scene-backdrop, #ede9ff)" />
      <ellipse cx="125" cy="218" rx="84" ry="7" fill="var(--scene-shadow, #d8d1f5)" />
      <g
        fill="none"
        stroke={ink}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="98" cy="57" r="22" fill={ink} stroke="none" />
        <path d="M98 91v62m0-47-33 31 50 11m-17-40 38 30 28-11m-66 26-10 51-25 10m35-61 48 3 18 57h25" />
      </g>
      <Laptop x={126} y={113} />
    </>
  );
}

function Laptop({ x, y }: { x: number; y: number }) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      stroke={ink}
      strokeWidth="3.5"
      strokeLinejoin="round"
      fill="var(--scene-paper, white)"
    >
      <path d="M0 0h80L69 42H-11Z" />
      <path d="M-13 46h88" strokeWidth="5" strokeLinecap="round" />
      <circle cx="35" cy="20" r="4" fill={ink} stroke="none" />
    </g>
  );
}

function ChartBoard() {
  return (
    <g className="scene-board">
      <rect
        x="218"
        y="80"
        width="336"
        height="245"
        rx="20"
        fill="var(--scene-paper, white)"
        stroke={ink}
        strokeWidth="3"
      />
      <path d="M218 120h336" stroke={ink} strokeWidth="3" />
      <circle cx="239" cy="101" r="5" fill="#fb7156" />
      <circle cx="257" cy="101" r="5" fill="#d2f66c" />
      <circle cx="275" cy="101" r="5" fill="#8a73f5" />
      <rect x="245" y="144" width="122" height="58" rx="10" fill="var(--scene-panel-a, #e0dbff)" />
      <text x="259" y="163" fontSize="11" fill="var(--scene-label, #443788)" fontFamily="inherit">
        КОНВЕРСИЯ
      </text>
      <text
        x="259"
        y="188"
        fontSize="23"
        fill={ink}
        fontFamily="inherit"
        fontWeight="750"
      >
        5,5%
      </text>
      <path
        d="m338 180 10-13 10 6"
        stroke="#4933ed"
        strokeWidth="3"
        fill="none"
      />
      <rect x="382" y="144" width="146" height="58" rx="10" fill="var(--scene-panel-b, #f0f9da)" />
      <text x="396" y="163" fontSize="11" fill="var(--scene-label, #426020)" fontFamily="inherit">
        НЕ СПЕШИ С ВЫВОДОМ
      </text>
      <text
        x="396"
        y="188"
        fontSize="19"
        fill={ink}
        fontFamily="inherit"
        fontWeight="750"
      >
        проверь ДИ
      </text>
      <path d="M247 282h275M247 221v61" stroke="#d8d5e6" strokeWidth="2" />
      <rect x="270" y="244" width="35" height="37" rx="6" fill="#c5bbff" />
      <rect x="326" y="232" width="35" height="49" rx="6" fill="#a696fb" />
      <rect x="382" y="220" width="35" height="61" rx="6" fill="#7761f4" />
      <rect x="438" y="208" width="35" height="73" rx="6" fill="#4933ed" />
      <path
        d="m277 237 57-9 65-11 54-9"
        stroke="#fb7156"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="453" cy="208" r="6" fill="#fb7156" />
    </g>
  );
}
