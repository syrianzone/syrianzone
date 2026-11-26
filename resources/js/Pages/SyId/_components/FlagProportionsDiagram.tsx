import React from 'react';
import { FLAG_SPECS } from '@/Domain/syid/facts';

interface FlagProportionsDiagramProps {
    ariaLabel?: string;
}

/**
 * Shared Syrian flag proportion diagram (36×24 units, 3:2 ratio) rendered on
 * both `/syid` and `/syid/flag`.
 */
export function FlagProportionsDiagram({ ariaLabel }: FlagProportionsDiagramProps) {
    return (
        <div className="flag-diagram-wrapper my-2">
            {/* One described image: the dimension labels alone are a list of
                bare numbers to a screen reader. */}
            <div
                className="flag-diagram-container"
                role="img"
                aria-label={ariaLabel ?? FLAG_SPECS.diagram_aria_label_ar}
            >
                <div className="flag-visual">
                    <div className="stripe green" />
                    <div className="stripe white">
                        <svg className="star" viewBox="0 0 100 95" aria-hidden="true">
                            <path d="M50,0 L61.2,36.2 L100,36.2 L69.1,58.8 L79.4,95 L50,72.5 L20.6,95 L30.9,58.8 L0,36.2 L38.8,36.2 Z" fill="#ce1126" />
                        </svg>
                        <svg className="star" viewBox="0 0 100 95" aria-hidden="true">
                            <path d="M50,0 L61.2,36.2 L100,36.2 L69.1,58.8 L79.4,95 L50,72.5 L20.6,95 L30.9,58.8 L0,36.2 L38.8,36.2 Z" fill="#ce1126" />
                        </svg>
                        <svg className="star" viewBox="0 0 100 95" aria-hidden="true">
                            <path d="M50,0 L61.2,36.2 L100,36.2 L69.1,58.8 L79.4,95 L50,72.5 L20.6,95 L30.9,58.8 L0,36.2 L38.8,36.2 Z" fill="#ce1126" />
                        </svg>
                    </div>
                    <div className="stripe black" />
                </div>

                <div className="dim-line h-line top-line-h" />
                <div className="measurement top-total-num">{FLAG_SPECS.grid_width}</div>
                <div className="dim-line v-line top-line-v-1" />
                <div className="dim-line v-line top-line-v-2" />
                <div className="dim-line v-line top-line-v-3" />
                <div className="dim-line v-line top-line-v-4" />
                <div className="dim-line v-line top-line-v-5" />
                <div className="measurement top-num-1">9</div>
                <div className="measurement top-num-2">9</div>
                <div className="measurement top-num-3">9</div>
                <div className="measurement top-num-4">9</div>

                <div className="dim-line v-line right-line-v" />
                <div className="measurement right-total-num">{FLAG_SPECS.grid_height}</div>
                <div className="dim-line h-line right-line-h-1" />
                <div className="dim-line h-line right-line-h-2" />
                <div className="dim-line h-line right-line-h-3" />
                <div className="dim-line h-line right-line-h-4" />
                <div className="measurement right-num-1">{FLAG_SPECS.stripe_height}</div>
                <div className="measurement right-num-2">{FLAG_SPECS.stripe_height}</div>
                <div className="measurement right-num-3">{FLAG_SPECS.stripe_height}</div>

                <div className="dim-line h-line bottom-line-h" />
                <div className="dim-line v-line bottom-line-v-1" />
                <div className="dim-line v-line bottom-line-v-2" />
                <div className="dim-line v-line bottom-line-v-3" />
                <div className="dim-line v-line bottom-line-v-4" />
                <div className="dim-line v-line bottom-line-v-5" />
                <div className="dim-line v-line bottom-line-v-6" />
                <div className="measurement bottom-num-1">{FLAG_SPECS.star_side_margin}</div>
                <div className="measurement bottom-num-2">{FLAG_SPECS.star_size}</div>
                <div className="measurement bottom-num-3">{FLAG_SPECS.star_gap}</div>
                <div className="measurement bottom-num-4">{FLAG_SPECS.star_size}</div>
                <div className="measurement bottom-num-5">{FLAG_SPECS.star_gap}</div>
                <div className="measurement bottom-num-6">{FLAG_SPECS.star_size}</div>
                <div className="measurement bottom-num-7">{FLAG_SPECS.star_side_margin}</div>

                <div className="dim-line v-line left-line-v" />
                <div className="measurement left-num-1">{FLAG_SPECS.star_size}</div>
                <div className="dim-line h-line left-line-h-1" />
                <div className="dim-line h-line left-line-h-2" />
            </div>
        </div>
    );
}
