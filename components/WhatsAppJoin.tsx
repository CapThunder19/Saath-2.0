import { WHATSAPP_GROUP } from "@/lib/registration";

// "Join the WhatsApp group" call-out shown after registering and in View ticket.
export default function WhatsAppJoin({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`whatsapp-join${compact ? " is-compact" : ""}`}>
      {!compact && (
        <p>
          <strong>Join the Saath 2.0 WhatsApp group</strong> for event updates, timings and announcements.
        </p>
      )}
      <a className="btn whatsapp-btn" href={WHATSAPP_GROUP} target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3Z"
          />
        </svg>
        Join WhatsApp group
      </a>
    </div>
  );
}
