// marquee 태그 타입 선언 (deprecated HTML 요소)
declare namespace JSX {
  interface IntrinsicElements {
    marquee: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        direction?: 'up' | 'down' | 'left' | 'right';
        behavior?: 'scroll' | 'slide' | 'alternate';
        scrollamount?: string | number;
        scrolldelay?: string | number;
        loop?: string | number;
      },
      HTMLElement
    >;
  }
}
