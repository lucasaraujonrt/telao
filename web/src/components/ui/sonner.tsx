import { Toaster as Sonner, type ToasterProps } from "sonner"

// No icons: the spec keeps toasts to text. Colors come from the tokens of the current theme.
const Toaster = (props: ToasterProps) => (
  <Sonner
    className="toaster group"
    gap={8}
    style={
      {
        "--normal-bg": "var(--surface)",
        "--normal-text": "var(--text)",
        "--normal-border": "var(--hairline)",
        "--border-radius": "16px",
        "--width": "360px",
      } as React.CSSProperties
    }
    toastOptions={{
      duration: 4000,
      classNames: {
        toast: "cn-toast !t-small !shadow-3 !px-4 !py-3",
      },
    }}
    {...props}
  />
)

export { Toaster }
