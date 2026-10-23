import { useId } from "react";
type Props = {
  variant?: "hero" | "guide" | "celebrate" | "investigate";
  className?: string;
};
/** Original Product Lab vector artwork. No remote assets, photos or third-party characters. */
export default function LabScene({ variant = "hero", className = "" }: Props) {
  const uid = useId();
  const title =
    variant === "hero"
      ? "Команда Product Lab: аналитик изучает график, коллега собирает дерево метрик"
      : variant === "celebrate"
        ? "Исследователь празднует завершение миссии"
        : variant === "investigate"
          ? "Аналитик с лупой проверяет данные"
          : "Продуктовый наставник с ноутбуком";
  return (
    <svg
      className={`lab-scene lab-scene-${variant} ${className}`}
      viewBox={variant === "guide" ? "335 163 200 305" : "0 0 640 500"}
      role="img"
      aria-labelledby={uid}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id={uid}>{title}</title>
      <path
        d="M66 411C-2 305 48 147 174 80c124-67 327-28 385 87 70 139 16 265-110 282C306 468 139 475 66 411Z"
        fill="#ede9ff"
      />
      <circle cx="536" cy="88" r="42" fill="#d2f66c" />
      <path
        d="m521 88 10 10 21-25"
        stroke="#242433"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g className="scene-board">
        <rect
          x="218"
          y="80"
          width="336"
          height="245"
          rx="20"
          fill="white"
          stroke="#242433"
          strokeWidth="3"
        />
        <path d="M218 120h336" stroke="#242433" strokeWidth="3" />
        <circle cx="239" cy="101" r="5" fill="#fb7156" />
        <circle cx="257" cy="101" r="5" fill="#d2f66c" />
        <circle cx="275" cy="101" r="5" fill="#8a73f5" />
        <rect x="245" y="144" width="122" height="58" rx="10" fill="#e0dbff" />
        <text x="259" y="163" fontSize="11" fill="#443788" fontFamily="inherit">
          КОНВЕРСИЯ
        </text>
        <text
          x="259"
          y="188"
          fontSize="23"
          fill="#29213f"
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
        <rect x="382" y="144" width="146" height="58" rx="10" fill="#f0f9da" />
        <text x="396" y="163" fontSize="11" fill="#426020" fontFamily="inherit">
          НЕ СПЕШИ С ВЫВОДОМ
        </text>
        <text
          x="396"
          y="188"
          fontSize="19"
          fill="#29213f"
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
          d="m277 230 57-18 65-16 54-22"
          stroke="#fb7156"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="453" cy="174" r="6" fill="#fb7156" />
      </g>
      <ellipse cx="314" cy="456" rx="239" ry="14" fill="#d8d1f5" />
      <g className="scene-person-one">
        <path
          d="m120 334-16 89 35 4 28-92"
          fill="#4933ed"
          stroke="#242433"
          strokeWidth="3"
        />
        <path
          d="m164 331 32 94 33-12-20-93"
          fill="#4933ed"
          stroke="#242433"
          strokeWidth="3"
        />
        <path d="m105 420-15 27c-2 8 28 11 47 4l3-27" fill="#242433" />
        <path d="m195 421 8 28c3 8 33 3 40-6l-18-30" fill="#242433" />
        <path
          d="M103 247c-23 27-24 75-7 98l118-9c1-46-2-80-22-101Z"
          fill="#d2f66c"
          stroke="#242433"
          strokeWidth="3"
        />
        <path
          d="m185 247 47 15 36-27 15 17-43 39c-7 7-17 6-25 2l-38-19"
          fill="#d2f66c"
          stroke="#242433"
          strokeWidth="3"
        />
        <path
          d="m266 236 9-17c4-8 13-7 14 0l-2 16 12-3c13 1 10 12 1 15l-17 5"
          fill="#e7ac8a"
          stroke="#242433"
          strokeWidth="3"
        />
        <path
          d="m139 223-1 25c11 8 27 6 31-6l-3-22"
          fill="#e7ac8a"
          stroke="#242433"
          strokeWidth="3"
        />
        <path
          d="M119 184c-2-28 48-44 67-17l-4 40c-8 33-52 34-61 1Z"
          fill="#e7ac8a"
          stroke="#242433"
          strokeWidth="3"
        />
        <path
          d="M114 191c-19-32 6-63 37-54 20-19 53 10 38 37-20 3-28-5-33-12-1 22-13 29-26 27l-3 20-13-3Z"
          fill="#242433"
        />
        <path
          d="M162 208c6 5 13 4 17-3"
          stroke="#242433"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="163" cy="187" r="3" fill="#242433" />
        <path
          d="m176 189 2 7-5 2"
          stroke="#242433"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="m100 264-14 47 34 23"
          stroke="#242433"
          strokeWidth="23"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="m96 266-11 44 37 22"
          stroke="#d2f66c"
          strokeWidth="18"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      <g className="scene-person-two">
        <path
          d="m395 367-17 69 23 4 31-69M439 365l21 72 25-5-8-68"
          fill="#7761f4"
          stroke="#242433"
          strokeWidth="3"
        />
        <path
          d="m378 433-15 15c-5 9 23 12 38 6l3-17M460 434l3 17c5 8 35 3 37-4l-16-16"
          fill="#242433"
        />
        <path
          d="M390 271c-26 24-31 71-11 101l106-2c15-26 3-81-21-101Z"
          fill="#fb7156"
          stroke="#242433"
          strokeWidth="3"
        />
        <path
          d="m415 246-2 28c15 15 28 10 33-2l-3-24"
          fill="#996448"
          stroke="#242433"
          strokeWidth="3"
        />
        <path
          d="M399 207c-4-22 46-39 58-10l-1 41c-7 29-47 32-53 1Z"
          fill="#b87f5b"
          stroke="#242433"
          strokeWidth="3"
        />
        <path
          d="M397 230c-32-24-6-60 10-57 16-21 51-4 56 11 13 14 7 45-5 49l-7-28c-22 6-33-2-39-10l-5 35"
          fill="#242433"
        />
        <circle
          cx="420"
          cy="219"
          r="9"
          fill="none"
          stroke="#242433"
          strokeWidth="3"
        />
        <circle
          cx="443"
          cy="218"
          r="9"
          fill="none"
          stroke="#242433"
          strokeWidth="3"
        />
        <path
          d="m429 218 5-1M427 242c6 3 11 1 14-4"
          stroke="#242433"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="m391 294-29 44 43 12M474 293l24 42-35 20"
          stroke="#242433"
          strokeWidth="22"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="m391 294-29 44 43 12M474 293l24 42-35 20"
          stroke="#fb7156"
          strokeWidth="17"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M374 317h101l-14 53h-75Z"
          fill="#c5bbff"
          stroke="#242433"
          strokeWidth="3"
        />
        <path
          d="M383 371h87"
          stroke="#242433"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="423" cy="345" r="7" fill="white" />
      </g>
      <g className="scene-note">
        <rect
          x="40"
          y="365"
          width="129"
          height="60"
          rx="12"
          fill="white"
          stroke="#242433"
          strokeWidth="2"
          transform="rotate(-8 40 365)"
        />
        <text
          x="55"
          y="387"
          fontFamily="inherit"
          fontSize="12"
          fill="#443788"
          transform="rotate(-8 40 365)"
        >
          Гипотеза ≠ факт
        </text>
        <path
          d="m57 401 13 4 28-9"
          stroke="#4933ed"
          strokeWidth="3"
          fill="none"
        />
      </g>
      {variant === "celebrate" && (
        <g fill="#fb7156">
          <path d="m79 90 8 20-14-4Z" />
          <path d="m586 362 14-12 2 18Z" />
          <circle cx="192" cy="51" r="7" />
          <path d="m556 35 13 9-14 8Z" />
        </g>
      )}
    </svg>
  );
}
