use bitvec::vec::BitVec;

pub trait Enumerable {
    fn to_index(&self) -> usize;
    fn from_index(index: usize) -> Option<Self>;
}

pub struct EBitset<T> {
    _marker: std::marker::PhantomData<T>,
    set: BitVec,
}

impl<T> EBitset<T>
where T: Enumerable {
    pub fn set(&mut self, key: T, value: bool) -> Result<(),()> {
        match self.set.get_mut(key.to_index()) {
            Some(mut idx) => {
                *idx = value;
                Ok(())
            },
            None => Err(())
        }
    }

    pub fn insert(&mut self, item: T) {
        let _ = self.set(item, true);
    }

    pub fn erase(&mut self, item: T) {
        let _ = self.set(item, false);
    }

    pub fn contains(&self, item: T) -> bool {
        match self.set.get(item.to_index()) {
            Some(idx) => *idx as bool,
            None => false,
        }
    }

    pub fn clear(&mut self) {
        self.set.clear();
    }

    pub fn len(&self) -> usize {
        self.set.count_ones()
    }
}
