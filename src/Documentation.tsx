import { motion } from 'motion/react';
import { cn } from './lib/utils';

const linkClass =
  'underline decoration-[#1A1A1A]/25 underline-offset-2 hover:text-[#F27D26] hover:decoration-[#F27D26]/40 transition-colors';

const sectionClass = 'mb-14 md:mb-16';
const h2Class =
  'font-serif text-2xl md:text-[1.75rem] italic tracking-tight text-[#1A1A1A] mb-4';
const h3Class =
  'text-[11px] uppercase tracking-[0.25em] font-bold text-[#A5A5A5] mb-3 mt-10 first:mt-0';
const pClass = 'text-[15px] leading-[1.75] text-[#1A1A1A]/88';
const listClass = 'list-disc pl-5 space-y-2 text-[15px] leading-[1.75] text-[#1A1A1A]/88';

export function DocumentationContent() {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-[720px] mx-auto w-full pb-8"
    >
      <p className={cn(pClass, 'text-[13px] uppercase tracking-[0.2em] font-bold text-[#A5A5A5] mb-3')}>
        Documentation
      </p>
      <h1 className="font-serif text-4xl md:text-[2.75rem] italic tracking-tight mb-8">
        Sugo Gallery — Documentation
      </h1>
      <p className={cn(pClass, 'mb-12 border-l-2 border-[#F27D26]/80 pl-5')}>
        Welcome to the Sugo Gallery documentation page. Here you&apos;ll find all the information you need to use
        the platform, understand our rules, and stay compliant with the sources we work with.
      </p>

      <section className={sectionClass}>
        <h2 className={h2Class}>1. Introduction</h2>
        <p className={pClass}>
          Sugo Gallery is a visual discovery tool designed to help you find and download travel and landscape images
          from trusted platforms, including{' '}
          <a
            href="https://unsplash.com/?utm_source=sugo_gallery&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Unsplash
          </a>{' '}
          and{' '}
          <a
            href="https://www.pexels.com?utm_source=sugo_gallery&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Pexels
          </a>
          . We do not host the images ourselves — we simply index and link to them, so all rights remain with the
          original photographers and their respective platforms.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>2. How to Use Sugo Gallery</h2>

        <h3 className={h3Class}>2.1 Search &amp; Filter Images</h3>
        <ul className={listClass}>
          <li>
            Enter a destination keyword (e.g., &ldquo;Santorini sunset&rdquo;, &ldquo;Swiss Alps&rdquo;) into the
            search bar.
          </li>
          <li>Click Fetch Images to retrieve relevant photos from our integrated sources.</li>
          <li>
            Browse the results, preview each image, and view details such as resolution, format, and photographer
            credits.
          </li>
        </ul>

        <h3 className={h3Class}>2.2 Download &amp; Save Images</h3>
        <ul className={listClass}>
          <li>Click the Download Link or Get Asset button next to the image you want.</li>
          <li>You will be redirected to the original source (Unsplash/Pexels) to complete the download.</li>
        </ul>
        <p className={cn(pClass, 'mt-4 text-[14px] text-[#1A1A1A]/70')}>
          <span className="font-semibold text-[#1A1A1A]/85">Note:</span> Your download will trigger an event to the
          source platform, which helps photographers track usage of their work.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>3. Usage &amp; Copyright Rules</h2>
        <p className={pClass}>
          All images on Sugo Gallery are sourced from Unsplash and Pexels, and are subject to their respective
          licenses. Please review the following guidelines carefully:
        </p>

        <h3 className={h3Class}>3.1 Source Licenses</h3>
        <ul className={listClass}>
          <li>
            <span className="font-semibold text-[#1A1A1A]">Unsplash:</span> Images are free to use for personal and
            commercial purposes, with no attribution required — but crediting the photographer is strongly encouraged.
            See the{' '}
            <a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer" className={linkClass}>
              Unsplash License
            </a>
            .
          </li>
          <li>
            <span className="font-semibold text-[#1A1A1A]">Pexels:</span> Images are free to use for personal and
            commercial purposes, with no attribution required. See the{' '}
            <a href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer" className={linkClass}>
              Pexels License
            </a>
            .
          </li>
          <li>Always check the original source&apos;s license for the most up-to-date terms.</li>
        </ul>

        <h3 className={h3Class}>3.2 Commercial vs. Non-Commercial Use</h3>
        <ul className={listClass}>
          <li>
            <span className="font-semibold text-[#1A1A1A]">Non-commercial use:</span> You may use images for personal
            projects, blogs, social media posts, or school work.
          </li>
          <li>
            <span className="font-semibold text-[#1A1A1A]">Commercial use:</span> You may use images in advertisements,
            websites, products, or client projects, provided you comply with the source platform&apos;s terms.
          </li>
          <li>We recommend keeping a record of your downloads in case you need to verify usage rights in the future.</li>
        </ul>

        <h3 className={h3Class}>3.3 Attribution Guidelines</h3>
        <p className={pClass}>
          Even when not required by the license, we strongly encourage you to credit the photographer and platform to
          support their work. The standard format is:
        </p>
        <blockquote className="my-6 border-l-2 border-[#1A1A1A]/15 pl-5 font-serif italic text-[17px] text-[#1A1A1A]/90">
          Photo by [Photographer&apos;s Full Name] on [Source Platform]
        </blockquote>
        <p className={cn(pClass, 'mb-2')}>Example:</p>
        <ul className={listClass}>
          <li>Photo by Tina P. on Pexels</li>
          <li>Photo by Christopher Izquierdo on Unsplash</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>4. Privacy &amp; Compliance</h2>

        <h3 className={h3Class}>4.1 Privacy Policy</h3>
        <p className={pClass}>
          Sugo Gallery does not collect or store any personal data unless explicitly provided by you (e.g., through
          feedback forms). Search queries and download activity are sent only to the source platforms for usage
          tracking purposes.
        </p>

        <h3 className={h3Class}>4.2 Data Usage</h3>
        <ul className={listClass}>
          <li>We do not sell or share your personal information with third parties.</li>
          <li>
            Download events are sent to Unsplash/Pexels solely to comply with their API requirements and to help
            photographers track their work.
          </li>
        </ul>

        <h3 className={h3Class}>4.3 Disclaimer</h3>
        <ul className={listClass}>
          <li>All images remain the property of their respective photographers and platforms.</li>
          <li>
            Sugo Gallery acts only as a search and discovery tool and is not responsible for any copyright infringement
            resulting from improper use of the images.
          </li>
          <li>
            Users are solely responsible for verifying the license terms of any image they download and ensuring their
            use complies with applicable laws.
          </li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>5. About Sugo Gallery</h2>
        <p className={pClass}>
          Sugo Gallery was created to make finding high-quality travel and landscape visuals easier for travelers,
          creators, and designers. Our goal is to build a simple, intuitive archive of destination imagery that respects
          photographers&apos; work and platform rules.
        </p>

        <h3 className={h3Class}>5.1 Contact &amp; Feedback</h3>
        <p className={pClass}>
          If you have questions, suggestions, or encounter issues with the platform, please reach out to us at:
        </p>
        <ul className={cn(listClass, 'mt-4')}>
          <li>
            Email:{' '}
            <a href="mailto:your-email@example.com" className={linkClass}>
              your-email@example.com
            </a>
          </li>
          <li>
            Feedback form:{' '}
            <span className="text-[#A5A5A5] italic">
              [link to your form, if applicable — replace with your URL when ready]
            </span>
          </li>
        </ul>

        <h3 className={h3Class}>5.2 Submissions &amp; Partnerships</h3>
        <p className={pClass}>
          We currently do not accept direct submissions from photographers, but we work with Unsplash and Pexels to index
          their growing libraries. If you represent a platform and would like to partner with us, please get in touch
          via the contact email above.
        </p>
      </section>
    </motion.article>
  );
}
