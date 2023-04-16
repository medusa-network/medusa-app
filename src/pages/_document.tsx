import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
      </Head>
      <body className="font-sans min-h-screen antialiased bg-light-primary dark:bg-dark-primary">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
