/**
 * Field-level validation feedback, wired the way the accessibility guide
 * requires (see Places' SubmitSheet): the message has an id and role="alert",
 * and the control points at it with aria-describedby + aria-invalid.
 *
 *   <Input id="title" {...fieldA11y('title-error', errors.title)} />
 *   <FieldError id="title-error" message={errors.title} />
 */
export default function FieldError({ id, message }: { id: string; message?: string }) {
    if (!message) return null;

    return (
        <p id={id} role="alert" className="text-xs text-destructive">
            {message}
        </p>
    );
}

/** The aria attributes a control needs to announce its FieldError. */
export function fieldA11y(errorId: string, message?: string) {
    return {
        'aria-invalid': !!message,
        'aria-describedby': message ? errorId : undefined,
    } as const;
}
