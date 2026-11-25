import React from 'react';

const LTR_TOKEN_REGEX = /(\b(?:BIN Lookup|Visa|QNB|BIN)\b|\b\d{4}-\d{2}-\d{2}\b|\b\d+(?:\.\d+)?%)/g;

interface BdiTextProps {
  text: string;
}

/**
 * Wraps Latin brand names, ISO dates, and percentage figures in `<bdi dir="ltr">`
 * so Arabic RTL sentences render with clean bidi ordering.
 */
export default function BdiText({ text }: BdiTextProps) {
  const parts = text.split(LTR_TOKEN_REGEX);
  return (
    <>
      {parts.map((part, idx) =>
        idx % 2 === 1 ? (
          <bdi key={idx} dir="ltr">
            {part}
          </bdi>
        ) : (
          <React.Fragment key={idx}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}
