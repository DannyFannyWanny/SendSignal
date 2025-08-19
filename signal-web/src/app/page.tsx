import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="container max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <h1 className="text-3xl font-bold text-neutral-900 mb-4">
            Signal Web
          </h1>
          <p className="text-neutral-600 mb-8">
            A modern platform for connecting people nearby
          </p>
          <button className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200">
            Get Started
          </button>
        </div>
      </div>
    </main>
  );
}
