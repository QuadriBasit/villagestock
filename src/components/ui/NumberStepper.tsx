import * as React from "react"
import {
  motion,
  AnimatePresence,
  useSpring,
  useTransform,
  useMotionValue,
  useReducedMotion,
} from "motion/react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/_hooks"
import { spring } from "@/lib/motion-tokens";

const numberStepperVariants = cva(
  [
    "inline-flex items-center",
    "rounded-full border border-[color:var(--line)] bg-[color:var(--surface-2)]",
  ],
  {
    variants: {
      size: {
        xs: "gap-1 p-0.5",
        sm: "gap-2 p-1.5",
        md: "gap-4 p-3",
        lg: "gap-5 p-4",
      },
    },
    defaultVariants: { size: "md" },
  }
)

const DIGIT_HEIGHT = { xs: 22, sm: 40, md: 60, lg: 76 } as const
const DIGIT_TEXT   = { xs: "text-sm", sm: "text-4xl", md: "text-6xl", lg: "text-7xl" } as const
const BTN_SIZE     = { xs: "w-7 h-7", sm: "w-10 h-10", md: "w-16 h-16", lg: "w-20 h-20" } as const
const ICON_SIZE    = { xs: 13, sm: 18, md: 28, lg: 34 } as const

export interface NumberStepperProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange">,
    VariantProps<typeof numberStepperVariants> {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
}

function Digit({ value, height, reduceMotion, disableBlur }: { value: number; height: number; reduceMotion: boolean; disableBlur: boolean }) {
  const mv      = useMotionValue(value)
  const springY = useSpring(
    mv,
    reduceMotion ? { stiffness: 2000, damping: 100 } : { stiffness: 280, damping: 18, mass: 0.7 }
  )

  const blurFilter = useTransform(springY, (latest) => {
    if (reduceMotion) return "none"
    const delta = Math.abs(latest - value)
    return `blur(${Math.min(delta * 4, 12)}px)`
  })

  React.useEffect(() => { mv.set(value) }, [value, mv])

  return (
    <motion.div
      style={{
        y:      useTransform(springY, (v) => -v * height),
        filter: disableBlur ? undefined : blurFilter,
      }}
      className="absolute inset-x-0 top-0 flex flex-col"
      aria-hidden
    >
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => (
        <div
          key={i}
          style={{ height }}
          className="flex items-center justify-center"
        >
          {n}
        </div>
      ))}
    </motion.div>
  )
}

interface StepButtonProps {
  onClick: () => void
  disabled: boolean
  "aria-label": string
  size: keyof typeof BTN_SIZE
  prefersReducedMotion: boolean
  canHover: boolean
  children: React.ReactNode
}

const StepButton = React.forwardRef<HTMLButtonElement, StepButtonProps>(
  ({ onClick, disabled, "aria-label": ariaLabel, size, prefersReducedMotion, canHover, children }, ref) => (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      whileHover={prefersReducedMotion || disabled || !canHover ? {} : { scale: 1.05 }}
      whileTap={
        prefersReducedMotion || disabled
          ? {}
          : { scale: 0.94, transition: { type: "spring", stiffness: 1000, damping: 15 } }
      }
      className={cn(
        "flex items-center justify-center rounded-full",
        "bg-[color:var(--surface)] shadow-[var(--shadow-sm)]",
        "text-[color:var(--ink)] transition-opacity",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--accent)_40%,transparent)]",
        "disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none",
        BTN_SIZE[size]
      )}
    >
      {children}
    </motion.button>
  )
)
StepButton.displayName = "StepButton"

export const NumberStepper = React.forwardRef<HTMLDivElement, NumberStepperProps>(
  (
    {
      value,
      onChange,
      min = 0,
      max = 999,
      step = 1,
      label = "Quantity",
      size = "md",
      className,
      ...props
    },
    ref
  ) => {
    const prefersReducedMotion = !!useReducedMotion()
    const canHover = useMediaQuery("(hover: hover) and (pointer: fine)")

    const [isSafari, setIsSafari] = React.useState(false)
    React.useEffect(() => {
      setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent))
    }, [])
    const height = DIGIT_HEIGHT[size ?? "md"]

    const [keyboardActive, setKeyboardActive] = React.useState(false)
    const reduceMotion = prefersReducedMotion || keyboardActive

    const increment = () => value < max && onChange(Math.min(value + step, max))
    const decrement = () => value > min && onChange(Math.max(value - step, min))

    const handleIncrementClick = () => { setKeyboardActive(false); increment() }
    const handleDecrementClick = () => { setKeyboardActive(false); decrement() }

    function handleSpinbuttonKey(e: React.KeyboardEvent) {
      const NAV_KEYS = [
        "ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft",
        "PageUp", "PageDown", "Home", "End",
      ]
      if (NAV_KEYS.includes(e.key)) setKeyboardActive(true)
      switch (e.key) {
        case "ArrowUp":
        case "ArrowRight":
          e.preventDefault()
          increment()
          break
        case "ArrowDown":
        case "ArrowLeft":
          e.preventDefault()
          decrement()
          break
        case "PageUp":
          e.preventDefault()
          onChange(Math.min(value + step * 10, max))
          break
        case "PageDown":
          e.preventDefault()
          onChange(Math.max(value - step * 10, min))
          break
        case "Home":
          e.preventDefault()
          onChange(min)
          break
        case "End":
          e.preventDefault()
          onChange(max)
          break
      }
    }

    const chars = Math.abs(value).toString().split("")
    const tokens = chars.map((char, idx) => {
      const isDigit = char >= "0" && char <= "9"
      const fromRight = chars.length - idx
      return {
        char,
        isDigit,
        key: isDigit ? `d${fromRight}` : `s${char}${fromRight}`,
      }
    })

    return (
      <div
        ref={ref}
        role="group"
        aria-label={label}
        className={cn("inline-block", className)}
        {...props}
      >
        <motion.div
          layout
          transition={spring.layout}
          className={cn(numberStepperVariants({ size }))}
        >
          <StepButton
            onClick={handleDecrementClick}
            disabled={value <= min}
            aria-label={`Decrease ${label}`}
            size={size ?? "md"}
            prefersReducedMotion={prefersReducedMotion}
            canHover={canHover}
          >
            <svg
              width={ICON_SIZE[size ?? "md"]}
              height={ICON_SIZE[size ?? "md"]}
              viewBox="0 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              aria-hidden
            >
              <line x1="6" y1="12" x2="18" y2="12" />
            </svg>
          </StepButton>

          <div
            role="spinbutton"
            aria-valuenow={value}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-label={label}
            tabIndex={0}
            onKeyDown={handleSpinbuttonKey}
            style={{ height }}
            className={cn(
              "relative flex items-center px-2 overflow-hidden",
              "font-bold tabular-nums tracking-tighter text-[color:var(--ink)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--accent)_40%,transparent)] rounded",
              "cursor-default",
              DIGIT_TEXT[size ?? "md"]
            )}
          >
            {value < 0 && (
              <span
                aria-hidden
                style={{ width: "0.5em", height }}
                className="flex items-center justify-center"
              >
                -
              </span>
            )}
            <AnimatePresence mode="popLayout" initial={false}>
              {tokens.map((token) => {
                if (!token.isDigit) {
                  return (
                    <span
                      key={token.key}
                      aria-hidden
                      style={{ width: "0.35em", height }}
                      className="flex items-center justify-center"
                    >
                      {token.char}
                    </span>
                  )
                }
                return (
                  <motion.div
                    key={token.key}
                    layout
                    initial={
                      reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: 30, scale: 0.6, ...(isSafari ? {} : { filter: "blur(16px)" }) }
                    }
                    animate={
                      reduceMotion
                        ? { opacity: 1 }
                        : { opacity: 1, y: 0, scale: 1, ...(isSafari ? {} : { filter: "blur(0px)" }) }
                    }
                    exit={
                      reduceMotion
                        ? { opacity: 0, position: "absolute" }
                        : { opacity: 0, y: -30, scale: 0.6, position: "absolute", ...(isSafari ? {} : { filter: "blur(16px)" }) }
                    }
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 22,
                      mass: 0.6,
                      filter: { duration: 0.2, ease: "easeOut" },
                    }}
                    className="relative flex justify-center"
                    style={{
                      width:  "0.65em",
                      height,
                    }}
                    aria-hidden
                  >
                    <Digit
                      value={parseInt(token.char, 10) || 0}
                      height={height}
                      reduceMotion={reduceMotion}
                      disableBlur={isSafari}
                    />
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <span className="sr-only">{value}</span>
          </div>

          <StepButton
            onClick={handleIncrementClick}
            disabled={value >= max}
            aria-label={`Increase ${label}`}
            size={size ?? "md"}
            prefersReducedMotion={prefersReducedMotion}
            canHover={canHover}
          >
            <svg
              width={ICON_SIZE[size ?? "md"]}
              height={ICON_SIZE[size ?? "md"]}
              viewBox="0 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              aria-hidden
            >
              <line x1="12" y1="6"  x2="12" y2="18" />
              <line x1="6"  y1="12" x2="18" y2="12" />
            </svg>
          </StepButton>
        </motion.div>
      </div>
    )
  }
)
NumberStepper.displayName = "NumberStepper"
