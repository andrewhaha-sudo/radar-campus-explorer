import * as AlertDialog from "@radix-ui/react-alert-dialog";
export function ConfirmAction({
  label,
  description,
  onConfirm,
  disabled = false,
}: {
  label: string;
  description: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger className="campus-secondary" disabled={disabled}>
        {label}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="student-overlay" />
        <AlertDialog.Content className="radar-dialog neon-frame">
          <AlertDialog.Title>{label}?</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          <div className="preparedness-actions">
            <AlertDialog.Cancel className="campus-secondary">
              Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action className="campus-primary" onClick={onConfirm}>
              Confirm {label.toLowerCase()}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
