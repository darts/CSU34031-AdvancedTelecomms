# CSU34031 Advanced Telecommunications

## Project-1 - Senán d'Art - 17329580

### Introduction

#### The problem:  

The problem description asked us to create a secure social media application that would allow individuals to choose who can decrypt their posts on the platform, to others the post would look like ciphertext.

Since the description of the problem was quite broad I decided to approach it as follows:  
Building a social media application in the style of a message board forum. All 'threads' and posts within those threads are visible.  
The standard webclient allows a user to interact with the website, visit threads, create threads and post in threads. In this mode all text will be rendered simply as text so ciphertext will look like garbage and normal text will look normal.  
When the user is logged in, they have the option to toggle a 'crypto mode' where they will veiw decrypted versions of the threads they are a member of. When in this mode, creating a thread will result in a thread that is encrypted and only visible to that user's 'friends'. When posting to a thread in crypto mode, the post will be visible to the 'friends' of the creator of that thread.

<br>

#### The Platform:

{some pics}

<br>

#### The Physical Crypto

I used a library called [hybrid-crypto-js](https://github.com/juhoen/hybrid-crypto-js) (https://github.com/juhoen/hybrid-crypto-js) to perform the encryption and decryption. It is an RSA+AES hybrid encryption system. I chose this library as it allowed me to simplify the design of the system as I could use public-private key cryptography but with a much smaller overhead. The library encrypts content using AES and then encrypts the AES keys with multiple public RSA keys. This negates the requirement for exchanging symmetric keys and provides better performance than pure RSA encryption.

<br>

#### Individual Key Management  

In my prototype, each user generated their own Public-Private RSA key pair when they create an account.  
In this prototype both keys are stored on the server, I understand this is a terrible idea and this was only done for simplicity, in an actual project, the private key would be stored on the user's device. The reason I chose to do this was to avoid the additional complexity of storing keys for each user locally. Again, I would not do this if this project was anything but a prototype.   
Ideally the public keys would be visible on a public service like [MIT's](https://pgp.mit.edu/) (https://pgp.mit.edu/) server. This would allow for greater transparency and could increase security.

<br>

#### Group Key Management  

Each thread is associated with a list of users and their public keys. This list is those individuals in the creator's 'secure group' (friends). This list is controlled by the creator of the thread, only they can add or remove people from the list. The application blocks other users from modifying this list.  
If a user is removed from the list, they will continue to be able to read messages that were sent while they were a member but any subsequent messages will appear as ciphertext. The title of the thread is re-encrypted to prevent the user from seeing changes.  
If a user is added to the list ('secure group'), the title of the thread is re-encrypted including the new user's public key so they can view it. They will not be able to view messages that were sent before they were added to the group (similar to WhatsApp) but all future messages are visible to them (unless of course they are removed from the group).






Link to code:  https://github.com/darts/CSU34031-AdvancedTelecomms/tree/master/Project-2
