import numpy as np


class BeliefPropagationChain:

    def __init__(self):
        self.phi = []  # unary
        self.psi = []  # binary

    def add_node(self, phi_i, psi_i):
        # phi_i = np.array(phi_i)
        # phi_i.shape = [phi_i.size, 1]
        if self.psi:
            assert (self.psi[-1].shape[1] == phi_i.shape[0])
        self.phi.append(phi_i)

        if psi_i is not None:
            # psi_i = np.array(psi_i)
            assert (phi_i.shape[0] == psi_i.shape[0])
            self.psi.append(psi_i)

    def max_joint_probability(self):
        n = len(self.phi)

        p = [None] * n
        label = [None] * n

        # forward pass
        m = 1
        for i in range(n - 1):
            m = m * self.phi[i]
            m = m / np.sum(m)
            p[i] = m
            m = self.psi[i].transpose() * m
            m = np.max(m, axis=1)

        # n-1 gets a special treatment, due to lacking psi
        m = m * self.phi[n-1]
        label[n - 1] = np.argmax(m)

        # backward pass
        m = 1
        for i in range(n - 2, -1, -1):
            m = m * self.phi[i + 1]
            m = m * self.psi[i]
            m = np.max(m, axis=1)
            # determine label
            m = m / np.sum(m)
            t = p[i] * m
            label[i] = np.argmax(t)

        return label

    def max_joint_probability_log(self):
        n = len(self.phi)

        p = [None] * n
        label = [None] * n

        # forward pass
        m = 1
        for i in range(n - 1):
            m = m + self.phi[i]
            # m = m / np.sum(m)
            p[i] = m
            m = self.psi[i].transpose() + m
            m = np.max(m, axis=1)

        # n-1 gets a special treatment, due to lacking psi
        m = m + self.phi[n-1]
        label[n - 1] = np.argmax(m)

        # backward pass
        m = 1
        for i in range(n - 2, -1, -1):
            m = m + self.phi[i + 1]
            m = m + self.psi[i]
            m = np.max(m, axis=1)
            # determine label
            # m = m / np.sum(m)
            t = p[i] + m
            label[i] = np.argmax(t)

        return label

    def max_joint_probability_reference_implementation(self):
        n = len(self.phi)

        # forward pass
        # m_fwd[i]  <-> m_{i-1 -> i}(x_i)
        m_fwd = [1] * n
        for i in range(n):
            if i == 0:
                m = 1
            else:
                m = m_fwd[i - 1]
                m = m * self.phi[i - 1]
                m.shape = [m.size, 1]
                m = m * self.psi[i - 1]
                m = np.max(m, axis=0)

            # m = m / np.sum(m)
            m_fwd[i] = m

        # backward pass
        # m_bwd[i] <-> m_{i+1->i}(x_i)
        m_bwd = [None] * n
        for i in range(n - 1, -1, -1):
            if i == n - 1:
                m = 1
            else:
                m = m_bwd[i + 1]
                m = m * self.phi[i + 1]
                # m.shape = [m.size, 1]
                m = m * self.psi[i]
                m = np.max(m, axis=1)

            # m = m / np.sum(m)
            m_bwd[i] = m

        # combine
        p = 1.0
        l = [0] * n
        for i in range(n):
            t = self.phi[i] * m_fwd[i] * m_bwd[i]
            # t = t / np.sum(t)
            l[i] = np.argmax(t)
            p = p * t[l[i]]

        return l, p

    def max_joint_probability_brute_force(self):
        n = len(self.phi)
        m = [len(phi_i) for phi_i in self.phi]

        l_best = None
        p_best = -1

        continue_enumeration = True

        l = [0] * n
        while continue_enumeration:
            # for i in range(n):
            #     print(l[i], end=" ")

            p = 1.0
            for i in range(n):
                p *= self.phi[i][l[i]]

            for i in range(n - 1):
                p *= self.psi[i][l[i]][l[i + 1]]

            # print(p)

            if p > p_best:
                p_best = p
                l_best = l.copy()

            for i in range(n-1, -1, -1):
                l[i] = (l[i] + 1) % m[i]
                if l[i] != 0:
                    break
                if i == 0:
                    continue_enumeration = False

        return l_best, p_best

    def solve_max_marginal(self):
        n = len(self.phi)

        # forward pass
        # m_fwd[i]  <-> m_{i-1 -> i}(x_i)
        m_fwd = [1] * n
        for i in range(n):
            if i == 0:
                m = 1
            else:
                m = m_fwd[i - 1]
                m = m * self.phi[i - 1]
                m = np.dot(m, self.psi[i - 1])

            # m = m / np.sum(m)
            m_fwd[i] = m

        # backward pass
        # m_bwd[i] <-> m_{i+1->i}(x_i)
        m_bwd = [None] * n
        for i in range(n - 1, -1, -1):
            if i == n - 1:
                m = 1
            else:
                m = m_bwd[i + 1]
                m = m * self.phi[i + 1]
                m = np.dot(self.psi[i], m)

            # m = m / np.sum(m)
            m_bwd[i] = m

        # combine
        p = 1.0
        l = [0] * n
        for i in range(n):
            t = self.phi[i] * m_fwd[i] * m_bwd[i]
            # t = t / np.sum(t)
            l[i] = np.argmax(t)

        return l
