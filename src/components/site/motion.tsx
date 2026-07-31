import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  animate,
  type Transition,
} from "framer-motion";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/* ---------------------------------------------------------------- tokens */

export const EASE_SIGNATURE = [0.22, 1, 0.36, 1] as const;
export const EASE_SNAP = [0.4, 0, 0.2, 1] as const;

export const springSoft: Transition = { type: "spring", stiffness: 240, damping: 28 };
export const springSnappy: Transition = { type: "spring", stiffness: 420, damping: 32 };

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_SIGNATURE } },
};

export const staggerParent = (stagger = 0.06, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------- stagger */

export function Stagger({
  children,
  className,
  stagger = 0.06,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  return (
    <motion.div
      variants={staggerParent(stagger, delay)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------- count-up */

export function CountUp({
  value,
  duration = 1.1,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const started = useRef(false);
  const from = useRef(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(value);
      from.current = value;
      return;
    }
    const start = started.current ? from.current : 0;
    started.current = true;
    const controls = animate(start, value, {
      duration: started.current && start !== 0 ? 0.6 : duration,
      ease: EASE_SIGNATURE,
      onUpdate: (v) => setDisplay(v),
      onComplete: () => {
        from.current = value;
        setDisplay(value);
      },
    });
    return () => controls.stop();
  }, [value, inView, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      {Math.round(display).toLocaleString()}
    </span>
  );
}

/* ------------------------------------------------------------ typewriter */

export function Typewriter({
  lines,
  speed = 18,
  linePause = 320,
  loopAfter = 14000,
  className,
}: {
  lines: string[];
  speed?: number;
  linePause?: number;
  loopAfter?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [out, setOut] = useState<string[]>([]);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduced) {
      setOut(lines);
      return;
    }
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    setOut([]);
    const run = async () => {
      const acc: string[] = [];
      for (const line of lines) {
        acc.push("");
        for (let i = 0; i <= line.length; i++) {
          if (cancelled) return;
          acc[acc.length - 1] = line.slice(0, i);
          setOut([...acc]);
          await new Promise((r) => timers.push(setTimeout(r, speed)));
        }
        await new Promise((r) => timers.push(setTimeout(r, linePause)));
      }
      timers.push(setTimeout(() => !cancelled && setCycle((c) => c + 1), loopAfter));
    };
    void run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, reduced, speed, linePause, loopAfter, lines.join("|")]);

  return (
    <span className={className}>
      {out.map((l, i) => (
        <span key={i} className="block whitespace-pre-wrap">
          {l}
          {i === out.length - 1 && !reduced && (
            <span className="caret-blink ml-0.5 inline-block h-[1em] w-[0.5ch] translate-y-[0.15em] bg-current align-baseline" />
          )}
        </span>
      ))}
    </span>
  );
}

/* -------------------------------------------------------------- spotlight */

export function Spotlight({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set(e.clientX - r.left);
        y.set(e.clientY - r.top);
      }}
      onPointerLeave={() => {
        x.set(-9999);
        y.set(-9999);
      }}
      className={`group/spot relative overflow-hidden ${className ?? ""}`}
      style={style}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background: useTransform(
            [x, y],
            ([cx, cy]) =>
              `radial-gradient(220px circle at ${cx}px ${cy}px, color-mix(in oklab, var(--color-foreground) 8%, transparent), transparent 70%)`,
          ),
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/* --------------------------------------------------------- scroll progress */

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 30, mass: 0.3 });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-foreground/70"
    />
  );
}

/* ---------------------------------------------------------------- skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className ?? ""}`} />;
}

/* ------------------------------------------------------------ magnetic btn */

export function Press({
  children,
  className,
  onClick,
  disabled,
  type = "button",
  title,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  return (
    <motion.button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { y: -2 }}
      whileTap={disabled ? {} : { scale: 0.96 }}
      transition={springSnappy}
      className={className}
    >
      {children}
    </motion.button>
  );
}
