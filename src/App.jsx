import { useState, useEffect } from 'react';
import { ArrowRight, Shield, Fingerprint, Lock, Layers, Globe, ChevronDown , X} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ConnectWallet from './components/ConnectWallet';
import abi from '../build/contracts/BiometricIdentityManager.json';
import { ethers } from 'ethers';
import FaceCapture from './components/FaceCapture';
import Login from './components/Login';
import { useNavigate } from 'react-router-dom'


  // Modal Component
  const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
  
    // Prevent body scrolling when modal is open
    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      }
      return () => {
        document.body.style.overflow = 'unset';
      };
    }, [isOpen]);
  
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center p-4 border-b border-slate-700">
            <h3 className="text-xl font-bold text-slate-100">{title}</h3>
            <button 
              onClick={onClose}
              className="p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
    );
  };
  
  // Registration Component
const RegistrationModal = ({ isOpen, onClose, walletAddress, contract, onRegistrationComplete }) => {
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [errorMessage, setErrorMessage] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  

  
};
  // Registration Component
  const Registration = ({ isOpen, onClose, walletAddress, contract, onRegistrationComplete }) => {
    const [status, setStatus] = useState('hidden');
    const [errorMessage, setErrorMessage] = useState('');
    useEffect(() => {
      if (isOpen) {
        setStatus('idle');
        setErrorMessage('');
      }
    }, [isOpen]);

    const handleHashReceived = async (hashBytes) => {
      if (!contract) return;
      
      try {
        const tx = await contract.registerIdentity(hashBytes);
        console.log("Transaction sent:", tx.hash);
        await tx.wait();
        console.log("Identity registered successfully!");
        setStatus("success")
        setTimeout(() => onRegistrationComplete(), 1500);
      } catch (error) {
        console.error("Registration error:", error);
      }
    };
  
    return (
      <div className="flex flex-col items-center">
        
        
        {status === 'idle' && (
          <FaceCapture 
            onHashReceived={handleHashReceived}
            walletAddress={walletAddress}
            captureButtonText="Start Registration"
          />
        )}
        
        {status === 'processing' && (
          <div className="flex flex-col items-center">
            <div className="animate-pulse w-16 h-16 rounded-full bg-indigo-500/30 flex items-center justify-center mb-4">
              <Fingerprint className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-slate-300">Processing registration...</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-green-500/30 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-slate-300">Registration successful!</p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-red-500/30 flex items-center justify-center mb-4">
              <X className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-red-400 text-center">{errorMessage}</p>
            <Button className="mt-4" onClick={() => setStatus('idle')}>Try Again</Button>
          </div>
        )}
      </div>
    );
  };
  
  // Success Component
  const AuthSuccess = () => {
    return (
      <div className="flex flex-col items-center p-6">
        <div className="w-16 h-16 rounded-full bg-green-500/30 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-xl font-bold mb-2 text-center">Authentication Successful!</h3>
        <p className="text-slate-300 text-center">You're now authenticated with your biometric identity.</p>
      </div>
    );
  };
  
  export default function App() {
    const [connectedAddress, setConnectedAddress] = useState(null);
    const [contract, setContract] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState('login'); // 'register', 'login', 'success'
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    
    const CONTRACT_ADDRESS = "0xb7aE28dEa40D216a001C3D687dA77d8b91d184B4";
    const CONTRACT_ABI = abi.abi;
    const navigate = useNavigate()
    // Handle wallet connection
    const handleConnected = async (signer) => {
      try {
        const address = await signer.getAddress();
        setConnectedAddress(address);
        
        // Initialize contract
        const contractInstance = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          signer
        );
        setContract(contractInstance);
        
        console.log("Connected to wallet:", address);
      } catch (error) {
        console.error("Connection error:", error);
      }
    };
    
  
    // Handle get started button click
    const handleGetStarted = () => {
      
      if (!connectedAddress) {
        alert("Please connect your wallet first");
        return;
      }
      setModalContent('register');
      setIsModalOpen(true);
    };
    const handleLoginBtn = () => {
      
      if (!connectedAddress) {
        alert("Please connect your wallet first");
        return;
      }
      setModalContent('login');
      setIsModalOpen(true);
    };
    
  
    // Modal transitions
    const handleRegistrationSuccess = () => {
      setModalContent('login');
    };
  
    const handleLoginSuccess = () => {
      navigate('/dashboard')
      setIsAuthenticated(true);
      setModalContent('success'); 
    
      // Close modal after delay to show success message
      setTimeout(() => {
        setIsModalOpen(false);
        navigate('/dashboard')
      }, 2000);
    };
  
    // Render Modal Content
    const renderModalContent = () => {
      switch (modalContent) {
        case 'register':
          return (
            <Registration 
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              walletAddress={connectedAddress}
              contract={contract}
              onRegistrationComplete={handleRegistrationSuccess}
            />
          );
        case 'login':
          return (
            <div className="flex flex-col items-center">
              <Login 
                contract={contract} 
                walletAddress={connectedAddress}
                onLoginSuccess={handleLoginSuccess}
              />
              
            </div>
          );
        case 'success':
          return <AuthSuccess />;
        default:
          return null;
      }
    };
  
    // Get the right button text based on authentication status
    const getButtonText = () => {
      if (isAuthenticated) {
        return "Profile Dashboard";
      } else {
        return "Get Started";
      }
    };
    const setRegister = () => {
      setModalContent('register')
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100">
        {/* Navigation */}
        <nav className="flex justify-between items-center py-4 px-6 lg:px-16 backdrop-blur-sm bg-slate-900/70 sticky top-0 z-50">
          <div className="flex items-center">
            <Fingerprint className="w-8 h-8 text-indigo-400 mr-2" />
            <span className="font-bold text-2xl tracking-tight">SKIBIDI ID</span>
          </div>
          
          <div className="hidden md:flex space-x-6 items-center">
            <a href="#features" className="hover:text-indigo-400 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-indigo-400 transition-colors">How It Works</a>
            <a href="#security" className="hover:text-indigo-400 transition-colors">Security</a>
            {!connectedAddress ? (
              <ConnectWallet onConnected={handleConnected} />
            ) : (
              <Button 
                variant="outline" 
                className="border-indigo-500 text-indigo-400 hover:bg-indigo-500 hover:text-white"
                onClick={
                  handleLoginBtn
                }
              >
                {getButtonText()} <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            )}
          </div>
          
          <button className="md:hidden">
            <ChevronDown className="w-6 h-6" />
          </button>
        </nav>
  
        {/* Hero Section */}
        <section className="pt-20 pb-32 px-6 lg:px-16">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-5xl lg:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">
                Your Identity, Secured by Blockchain
              </h1>
              <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                A revolutionary decentralized digital identity platform that puts you in control of your personal data. Secure, private, and truly yours.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                {!connectedAddress ? (
                  <ConnectWallet 
                    onConnected={handleConnected} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors"
                  />
                ) : (
                  <Button 
                    size="lg" 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium text-lg"
                    onClick={handleGetStarted}
                  >
                    {getButtonText()} <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                )}
                <Modal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)} 
                title={"Register"}
                children={
                  renderModalContent()
                }
                />
                      
                <Button variant="outline" size="lg" className="border-slate-500 text-slate-300 hover:bg-slate-700">
                  Learn More
                </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-30"></div>
            <div className="relative bg-slate-800 rounded-2xl p-8 border border-slate-700">
              <div className="flex items-center justify-center h-64 mb-6">
                <div className="relative">
                  <Fingerprint className="w-32 h-32 text-indigo-400 opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-purple-500/20 animate-pulse"></div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-3 bg-slate-700 rounded-full w-3/4"></div>
                <div className="h-3 bg-slate-700 rounded-full"></div>
                <div className="h-3 bg-slate-700 rounded-full w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-indigo-900/30 py-16 px-6 lg:px-16">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-4xl font-bold text-indigo-400 mb-2">100%</p>
            <p className="text-slate-300">User Controlled</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-indigo-400 mb-2">24/7</p>
            <p className="text-slate-300">Availability</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-indigo-400 mb-2">0</p>
            <p className="text-slate-300">Data Breaches</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-indigo-400 mb-2">10K+</p>
            <p className="text-slate-300">Active Users</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 lg:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose SKIBIDI ID</h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Our platform offers a revolutionary approach to digital identity management,
              powered by blockchain technology and cutting-edge biometrics.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 hover:border-indigo-500 transition-colors">
              <div className="bg-indigo-500/20 p-3 rounded-lg w-fit mb-6">
                <Shield className="text-indigo-400 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Bulletproof Security</h3>
              <p className="text-slate-300">
                Military-grade encryption and blockchain verification ensures your identity
                can never be compromised or stolen.
              </p>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 hover:border-indigo-500 transition-colors">
              <div className="bg-indigo-500/20 p-3 rounded-lg w-fit mb-6">
                <Lock className="text-indigo-400 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Complete Privacy</h3>
              <p className="text-slate-300">
                Your biometric data never leaves your device. Only cryptographic proofs
                are stored on the blockchain.
              </p>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 hover:border-indigo-500 transition-colors">
              <div className="bg-indigo-500/20 p-3 rounded-lg w-fit mb-6">
                <Layers className="text-indigo-400 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Decentralized Architecture</h3>
              <p className="text-slate-300">
                No central authority controls your data. Your identity exists across
                thousands of nodes, ensuring availability and redundancy.
              </p>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 hover:border-indigo-500 transition-colors">
              <div className="bg-indigo-500/20 p-3 rounded-lg w-fit mb-6">
                <Globe className="text-indigo-400 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Universal Access</h3>
              <p className="text-slate-300">
                Verify your identity across any platform, service or application
                with a single, seamless experience.
              </p>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 hover:border-indigo-500 transition-colors">
              <div className="bg-indigo-500/20 p-3 rounded-lg w-fit mb-6">
                <Fingerprint className="text-indigo-400 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Biometric Authentication</h3>
              <p className="text-slate-300">
                Use your unique facial features to prove your identity without
                passwords, dongles or other fallible methods.
              </p>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 hover:border-indigo-500 transition-colors">
              <div className="bg-indigo-500/20 p-3 rounded-lg w-fit mb-6">
                <ArrowRight className="text-indigo-400 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">One-Click Verification</h3>
              <p className="text-slate-300">
                Simplify your online experience with instant identity verification
                anywhere, anytime - no more complex KYC processes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 px-6 lg:px-16 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Our platform simplifies identity verification while maintaining the highest levels of security and privacy.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-24 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            
            <div className="relative">
              <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 h-full">
                <div className="bg-indigo-500 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg mb-6 relative z-10">1</div>
                <h3 className="text-xl font-bold mb-3">Connect Your Wallet</h3>
                <p className="text-slate-300">
                  Link your crypto wallet to establish your unique blockchain identity and secure your personal data.
                </p>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 h-full">
                <div className="bg-indigo-500 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg mb-6 relative z-10">2</div>
                <h3 className="text-xl font-bold mb-3">Register Facial Biometrics</h3>
                <p className="text-slate-300">
                  Use your device's camera to capture and encrypt your facial biometric data, which never leaves your device.
                </p>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 h-full">
                <div className="bg-indigo-500 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg mb-6 relative z-10">3</div>
                <h3 className="text-xl font-bold mb-3">Verify Instantly</h3>
                <p className="text-slate-300">
                  Use your biometric ID across any platform that supports SKIBIDI ID with a simple scan and confirmation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 lg:px-16">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-indigo-900/70 to-purple-900/70 rounded-2xl p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Take Control of Your Digital Identity?</h2>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Join thousands of users who have already secured their online presence with blockchain technology.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              {!connectedAddress ? (
                <ConnectWallet 
                  onConnected={handleConnected} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium text-lg"
                />
              ) : (
                <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Get Started <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-24 px-6 lg:px-16 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Bank-Level Security, User-Friendly Design</h2>
              <p className="text-xl text-slate-300 mb-6">
                SKIBIDI ID employs cutting-edge cryptographic techniques to ensure your identity remains secure at all times.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="bg-green-500/20 p-1 rounded-full mr-3 mt-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-slate-300">Zero-knowledge proofs for maximum privacy</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-green-500/20 p-1 rounded-full mr-3 mt-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-slate-300">Immutable blockchain records prevent tampering</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-green-500/20 p-1 rounded-full mr-3 mt-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-slate-300">End-to-end encryption of all sensitive data</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-green-500/20 p-1 rounded-full mr-3 mt-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-slate-300">Regular security audits by leading blockchain experts</span>
                </li>
              </ul>
            </div>
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-indigo-500 rounded-2xl blur opacity-30"></div>
              <div className="relative bg-slate-800 rounded-2xl p-8 border border-slate-700">
                <Alert className="mb-6 bg-indigo-900/30 border-indigo-800">
                  <div className="flex items-center">
                    <Lock className="w-5 h-5 text-indigo-400 mr-2" />
                    <div className="font-medium">Your data is secure</div>
                  </div>
                  <AlertDescription className="mt-2 text-slate-300">
                    All biometric data is processed locally and never stored on our servers.
                    Only cryptographic hashes are sent to the blockchain.
                  </AlertDescription>
                </Alert>
                <div className="space-y-4">
                  <div className="h-10 bg-slate-700/50 rounded-md flex items-center px-4">
                    <div className="w-3/4 h-3 bg-slate-600 rounded-full"></div>
                  </div>
                  <div className="h-10 bg-slate-700/50 rounded-md flex items-center px-4">
                    <div className="w-1/2 h-3 bg-slate-600 rounded-full"></div>
                  </div>
                  <div className="h-10 bg-slate-700/50 rounded-md flex items-center px-4">
                    <div className="w-2/3 h-3 bg-slate-600 rounded-full"></div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <div className="w-8 h-8 rounded-md bg-indigo-500/20 flex items-center justify-center">
                      <Lock className="w-4 h-4 text-indigo-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-6 lg:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h3 className="font-bold text-white mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">How It Works</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">Company</h3>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-indigo-400 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">API</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Support</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Community</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Data Protection</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Compliance</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <Fingerprint className="w-6 h-6 text-indigo-400 mr-2" />
              <span className="font-bold">SKIBIDI ID</span>
            </div>
            <p>&copy; {new Date().getFullYear()} SKIBIDI Blockchain. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}