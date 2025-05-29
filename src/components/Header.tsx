'use client';

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Price Master
            </h1>
            <span className="ml-2 text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              v1.0
            </span>
          </div>
          
          <nav className="hidden md:flex space-x-8">
            <a 
              href="#scanner" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Scanner
            </a>
            <a 
              href="#calculator" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Calculator
            </a>
            <a 
              href="#converter" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Converter
            </a>
          </nav>
          
          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}