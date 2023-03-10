function Footer() {
  return (
    <footer class="w-full justify-center px-4 pb-4 text-center text-sm leading-relaxed text-gray-400">
      <p class="">
        Made with ❤️ by{" "}
        <a
          class="text-gray-100 hover:text-gray-200"
          href="https://github.com/GeeekyBoy"
          target="_blank"
        >
          GeeekyBoy
        </a>{" "}
        in Egypt
        <br />
        <a
          class="text-gray-100 hover:text-gray-200"
          href="https://github.com/microsoft/fluentui-emoji"
          target="_blank"
        >
          Fluent Emojis
        </a>{" "}
        designed by Microsoft
        <br />
        Copyright © {new Date().getFullYear()} GeeekyBoy &amp; Mango
        Contributors
      </p>
    </footer>
  );
}

export default Footer;
