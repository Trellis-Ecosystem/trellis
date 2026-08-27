import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { useWallet } from '../lib/useWallet';
import { useContractInvoke } from '../hooks/useContractInvoke';
import { agreementIdToScVal, milestoneToScVal } from '../lib/soroban';

interface MilestoneInput {
  amount: string;
}

const AGREEMENT_ID_PATTERN = /^[0-9a-fA-F]{64}$/;

export default function CreatePage() {
  const wallet = useWallet();
  const navigate = useNavigate();
  const { invoke } = useContractInvoke();

  const [formData, setFormData] = useState({
    agreementId: '',
    payer: '',
    payee: '',
    token: '',
    resolver: '',
  });

  const [milestones, setMilestones] = useState<MilestoneInput[]>([{ amount: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMilestoneChange = (index: number, value: string) => {
    const newMilestones = [...milestones];
    newMilestones[index].amount = value;
    setMilestones(newMilestones);
  };

  const addMilestone = () => {
    setMilestones([...milestones, { amount: '' }]);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!wallet.connected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!formData.agreementId.trim()) {
      setError('Please enter an agreement ID');
      return;
    }

    if (!AGREEMENT_ID_PATTERN.test(formData.agreementId.trim())) {
      setError('Agreement ID must be exactly 64 hex characters (0-9, a-f)');
      return;
    }

    if (!formData.payee.trim()) {
      setError('Please enter payee address');
      return;
    }

    if (!formData.token.trim()) {
      setError('Please enter token address');
      return;
    }

    if (!formData.resolver.trim()) {
      setError('Please enter resolver address');
      return;
    }

    if (milestones.some((m) => !m.amount.trim())) {
      setError('Please fill in all milestone amounts');
      return;
    }

    if (milestones.some((m) => !/^[0-9]+$/.test(m.amount.trim()) || BigInt(m.amount.trim()) <= 0n)) {
      setError('Milestone amounts must be positive whole numbers');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const agreementId = formData.agreementId.trim().toLowerCase();
      const milestoneVec = xdr.ScVal.scvVec(
        milestones.map((m, index) =>
          milestoneToScVal({ id: index, amount: m.amount.trim(), status: 'Pending', proof_uri: null }),
        ),
      );

      const args = [
        agreementIdToScVal(agreementId),
        nativeToScVal(wallet.address, { type: 'address' }),
        nativeToScVal(formData.payee.trim(), { type: 'address' }),
        nativeToScVal(formData.token.trim(), { type: 'address' }),
        milestoneVec,
        nativeToScVal(formData.resolver.trim(), { type: 'address' }),
      ];

      await invoke('init', args, wallet.address!);

      setSuccess(true);
      setTimeout(() => {
        navigate(`/agreement/${agreementId}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agreement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-900 via-navy-800 to-navy-900 dark:from-navy-900 dark:via-navy-800 dark:to-navy-900 light:from-white light:via-gray-50 light:to-white px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white dark:text-white light:text-gray-900 mb-8">Create Agreement</h1>

        {!wallet.connected ? (
          <div className="bg-yellow-900 dark:bg-yellow-900 light:bg-yellow-50 border border-yellow-700 dark:border-yellow-700 light:border-yellow-200 rounded-lg p-6 mb-8">
            <p className="text-yellow-200 dark:text-yellow-200 light:text-yellow-800">Please connect your wallet to create an agreement.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Agreement ID */}
            <div>
              <label htmlFor="agreementId" className="block text-white dark:text-white light:text-gray-900 font-semibold mb-2">Agreement ID (hex)</label>
              <input
                id="agreementId"
                type="text"
                name="agreementId"
                value={formData.agreementId}
                onChange={handleInputChange}
                placeholder="0x0000..."
                className="w-full px-4 py-3 rounded-lg bg-navy-700 dark:bg-navy-700 light:bg-white border border-navy-600 dark:border-navy-600 light:border-gray-300 text-white dark:text-white light:text-gray-900 placeholder-gray-500 dark:placeholder-gray-500 light:placeholder-gray-400 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Payer Address (readonly) */}
            <div>
              <label htmlFor="payer" className="block text-white dark:text-white light:text-gray-900 font-semibold mb-2">Payer (You)</label>
              <input
                id="payer"
                type="text"
                value={wallet.address || ''}
                disabled
                className="w-full px-4 py-3 rounded-lg bg-navy-700 dark:bg-navy-700 light:bg-gray-100 border border-navy-600 dark:border-navy-600 light:border-gray-300 text-gray-400 dark:text-gray-400 light:text-gray-500 cursor-not-allowed"
              />
            </div>

            {/* Payee Address */}
            <div>
              <label htmlFor="payee" className="block text-white dark:text-white light:text-gray-900 font-semibold mb-2">Payee Address</label>
              <input
                id="payee"
                type="text"
                name="payee"
                value={formData.payee}
                onChange={handleInputChange}
                placeholder="G..."
                className="w-full px-4 py-3 rounded-lg bg-navy-700 dark:bg-navy-700 light:bg-white border border-navy-600 dark:border-navy-600 light:border-gray-300 text-white dark:text-white light:text-gray-900 placeholder-gray-500 dark:placeholder-gray-500 light:placeholder-gray-400 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Token Address */}
            <div>
              <label htmlFor="token" className="block text-white dark:text-white light:text-gray-900 font-semibold mb-2">Token Contract Address</label>
              <input
                id="token"
                type="text"
                name="token"
                value={formData.token}
                onChange={handleInputChange}
                placeholder="C..."
                className="w-full px-4 py-3 rounded-lg bg-navy-700 dark:bg-navy-700 light:bg-white border border-navy-600 dark:border-navy-600 light:border-gray-300 text-white dark:text-white light:text-gray-900 placeholder-gray-500 dark:placeholder-gray-500 light:placeholder-gray-400 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Dispute Resolver */}
            <div>
              <label htmlFor="resolver" className="block text-white dark:text-white light:text-gray-900 font-semibold mb-2">Dispute Resolver Address</label>
              <input
                id="resolver"
                type="text"
                name="resolver"
                value={formData.resolver}
                onChange={handleInputChange}
                placeholder="G..."
                className="w-full px-4 py-3 rounded-lg bg-navy-700 dark:bg-navy-700 light:bg-white border border-navy-600 dark:border-navy-600 light:border-gray-300 text-white dark:text-white light:text-gray-900 placeholder-gray-500 dark:placeholder-gray-500 light:placeholder-gray-400 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Milestones */}
            <div>
              <label className="block text-white dark:text-white light:text-gray-900 font-semibold mb-4">Milestones</label>
              <div className="space-y-3">
                {milestones.map((milestone, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="number"
                      value={milestone.amount}
                      onChange={(e) => handleMilestoneChange(index, e.target.value)}
                      placeholder="Amount (smallest token unit)"
                      className="min-w-0 flex-1 px-4 py-3 rounded-lg bg-navy-700 dark:bg-navy-700 light:bg-white border border-navy-600 dark:border-navy-600 light:border-gray-300 text-white dark:text-white light:text-gray-900 placeholder-gray-500 dark:placeholder-gray-500 light:placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                    />
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMilestone(index)}
                        className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addMilestone}
                className="mt-3 px-4 py-2 bg-navy-700 dark:bg-navy-700 light:bg-gray-100 hover:bg-navy-600 dark:hover:bg-navy-600 light:hover:bg-gray-200 text-cyan-400 dark:text-cyan-400 light:text-cyan-600 font-semibold rounded-lg transition-colors border border-navy-600 dark:border-navy-600 light:border-gray-300"
              >
                + Add Milestone
              </button>
            </div>

            {/* Error Message */}
            {error && <div className="bg-red-900 dark:bg-red-900 light:bg-red-50 border border-red-700 dark:border-red-700 light:border-red-200 rounded-lg p-4 text-red-200 dark:text-red-200 light:text-red-800">{error}</div>}

            {/* Success Message */}
            {success && (
              <div className="bg-green-900 dark:bg-green-900 light:bg-green-50 border border-green-700 dark:border-green-700 light:border-green-200 rounded-lg p-4 text-green-200 dark:text-green-200 light:text-green-800">
                Agreement created successfully! Redirecting...
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-cyan-400 hover:bg-cyan-300 text-navy-900 font-bold text-lg rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Agreement'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
